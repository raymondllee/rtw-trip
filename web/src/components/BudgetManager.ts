/**
 * Budget Manager UI Component (Recommendation J)
 * Provides integrated budget tracking, editing, and management interface
 */

import type { TripBudget, TripData } from '../types/trip';
import { calculateBudgetStatus, createDefaultBudget } from '../utils/budgetTracker';
import { getCurrencyForDestination } from '../utils/currencyMapping';
import { getRuntimeConfig } from '../config';

export class BudgetManager {
  private container: HTMLElement;
  private tripData: TripData;
  private budget: TripBudget | null;
  private onBudgetUpdate?: (budget: TripBudget) => void;
  private editedCosts: Map<string, any> = new Map();
  private onCostsUpdate?: (costs: any[]) => Promise<void>;
  private exchangeRates: { [key: string]: number } = {};
  private ratesFetchDate: string = '';
  private autoSaveTimer: number | null = null;
  private savingCosts: Set<string> = new Set();

  constructor(
    container: HTMLElement,
    tripData: TripData,
    budget?: TripBudget,
    onBudgetUpdate?: (budget: TripBudget) => void,
    onCostsUpdate?: (costs: any[]) => Promise<void>
  ) {
    this.container = container;
    this.tripData = tripData;
    this.budget = budget || null;
    this.onBudgetUpdate = onBudgetUpdate;
    this.onCostsUpdate = onCostsUpdate;

    // Fetch exchange rates on initialization
    this.fetchExchangeRates();

    this.render();
  }

  private scheduleAutoSave() {
    // Clear existing timer
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
    }

    // Schedule save for 2 seconds after last edit
    this.autoSaveTimer = window.setTimeout(async () => {
      await this.saveAllCosts();
    }, 2000);
  }

  private async saveAllCosts() {
    if (this.editedCosts.size === 0 || !this.onCostsUpdate) return;

    try {
      const costsToSave = Array.from(this.editedCosts.values());

      // Show saving indicator
      this.showSavingIndicator(true);

      await this.onCostsUpdate(costsToSave);

      // Clear edited costs after successful save
      this.editedCosts.clear();

      // Update totals without full re-render
      this.updateCostTotals();

      // Show success indicator briefly
      this.showSavingIndicator(false, true);
    } catch (error) {
      console.error('Failed to auto-save costs:', error);
      this.showSavingIndicator(false, false, 'Failed to save');
    }
  }

  private showSavingIndicator(saving: boolean, success?: boolean, message?: string) {
    const indicators = this.container.querySelectorAll('.auto-save-indicator');
    indicators.forEach(indicator => {
      if (saving) {
        indicator.textContent = '💾 Saving...';
        indicator.className = 'auto-save-indicator saving';
      } else if (success) {
        indicator.textContent = '✓ Saved';
        indicator.className = 'auto-save-indicator saved';
        setTimeout(() => {
          indicator.textContent = '';
          indicator.className = 'auto-save-indicator';
        }, 2000);
      } else {
        indicator.textContent = message || '✗ Save failed';
        indicator.className = 'auto-save-indicator error';
      }
    });
  }

  private updateCostTotals() {
    // Update totals for each country without full re-render
    const countries = new Set<string>();
    (this.tripData.locations || []).forEach(loc => {
      if (loc.country) countries.add(loc.country);
    });

    countries.forEach(country => {
      const countryCosts = (this.tripData.costs || [])
        .filter(c => {
          const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
          return location?.country === country;
        });

      const total = countryCosts.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

      const totalElement = this.container.querySelector(`.country-total-row[data-country="${country}"] .country-total-amount`);
      if (totalElement) {
        totalElement.textContent = this.formatCurrency(total);
      }
    });
  }

  private async fetchExchangeRates() {
    try {
      // Using exchangerate-api.io free tier (1500 requests/month)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();

      if (data && data.rates) {
        this.exchangeRates = data.rates;
        this.ratesFetchDate = new Date(data.time_last_updated * 1000).toLocaleDateString();
        console.log('✅ Exchange rates fetched:', this.ratesFetchDate);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      // Set default rates if API fails
      this.exchangeRates = {
        USD: 1,
        // Europe
        EUR: 0.92,
        GBP: 0.79,
        CHF: 0.88,
        NOK: 10.50,
        SEK: 10.30,
        DKK: 6.85,
        // Asia
        JPY: 149.50,
        CNY: 7.24,
        INR: 83.12,
        THB: 34.50,
        VND: 24450,
        SGD: 1.34,
        MYR: 4.65,
        IDR: 15600,
        PHP: 56.50,
        KRW: 1320,
        TWD: 31.50,
        BTN: 83.12,
        NPR: 133,
        // Oceania
        AUD: 1.52,
        NZD: 1.68,
        FJD: 2.24,
        // Americas
        CAD: 1.36,
        BRL: 5.75,
        ARS: 350,
        CLP: 920,
        PEN: 3.70,
        COP: 3900,
        // Africa
        ZAR: 18.50,
        EGP: 30.90,
        MAD: 10.10,
        KES: 129,
        TZS: 2500,
        NAD: 18.50,
        MGA: 4500,
        // Middle East
        AED: 3.67,
        SAR: 3.75,
        ILS: 3.65,
        TRY: 32
      };
      this.ratesFetchDate = 'Using default rates';
    }
  }

  private async refreshExchangeRates(currencies?: string[]): Promise<void> {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();

      if (data && data.rates) {
        // Update specific currencies if provided, otherwise update all
        if (currencies && currencies.length > 0) {
          currencies.forEach(currency => {
            if (data.rates[currency]) {
              this.exchangeRates[currency] = data.rates[currency];
            }
          });
        } else {
          this.exchangeRates = data.rates;
        }
        this.ratesFetchDate = new Date(data.time_last_updated * 1000).toLocaleDateString();
        console.log('✅ Exchange rates refreshed:', currencies ? currencies.join(', ') : 'all');
      }
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error);
      throw error;
    }
  }

  private async generateCostsForCountry(country: string, destinationIds: string[]): Promise<any[]> {
    // Get destinations for this country
    const destinations = destinationIds
      .map(id => (this.tripData.locations || []).find(loc => String(loc.id) === id))
      .filter(d => d);

    if (destinations.length === 0) {
      throw new Error('No valid destinations found');
    }

    // Build enriched destination data for the prompt
    const enrichedDestinations = destinations.map(dest => {
      const localCurrency = getCurrencyForDestination(dest.id, this.tripData.locations || []);

      return {
        id: dest.id,
        normalizedId: String(dest.id),
        name: dest.name || dest.city,
        city: dest.city,
        country: dest.country,
        region: dest.region,
        activityType: dest.activity_type,
        durationDays: dest.duration_days || 1,
        arrivalDate: dest.arrival_date,
        departureDate: dest.departure_date,
        highlights: Array.isArray(dest.highlights) ? dest.highlights : [],
        notes: dest.notes || '',
        localCurrency: localCurrency
      };
    });

    // Generate prompt
    const prompt = this.generateCostPrompt(enrichedDestinations, country);

    // Get API configuration
    const config = getRuntimeConfig();
    const chatApiUrl = config.endpoints.chat;

    // Get scenario ID from window
    const scenarioId = (window as any).currentScenarioId || null;

    // Call the chat API
    const response = await fetch(chatApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        context: {
          destinations: enrichedDestinations.map(d => ({
            id: d.id,
            name: d.name,
            country: d.country,
            duration_days: d.durationDays
          }))
        },
        scenario_id: scenarioId,
        session_id: null // New session for cost generation
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the response text
    const responseText = data.response || data.text || '';

    // Try to parse JSON from the response
    let costs = this.parseAICostResponse(responseText, enrichedDestinations);

    return costs;
  }

  private generateCostPrompt(destinations: any[], country: string): string {
    const destinationBlocks = destinations.map((dest, index) => {
      const lines = [];
      lines.push(`${index + 1}. ${dest.name}${dest.city ? ` (${dest.city})` : ''}, ${country}`);

      if (dest.region) {
        lines.push(`   Region: ${dest.region}`);
      }

      if (dest.arrivalDate || dest.departureDate || dest.durationDays) {
        const dateBits = [];
        if (dest.arrivalDate) dateBits.push(`Arrive ${dest.arrivalDate}`);
        if (dest.departureDate) dateBits.push(`Depart ${dest.departureDate}`);
        dateBits.push(`${dest.durationDays} days`);
        lines.push(`   Schedule: ${dateBits.join(' • ')}`);
      }

      if (dest.activityType) {
        lines.push(`   Primary focus: ${dest.activityType}`);
      }

      const highlights = (dest.highlights || []).slice(0, 5);
      if (highlights.length) {
        lines.push(`   Highlights: ${highlights.join(', ')}`);
      }

      if (dest.notes) {
        lines.push(`   Notes: ${dest.notes}`);
      }

      lines.push(`   Local Currency: ${dest.localCurrency}`);
      lines.push(`   Destination ID: ${dest.normalizedId}`);
      return lines.join('\n');
    }).join('\n\n');

    return `You are the RTW trip cost-planning assistant. Help estimate costs for the destinations below in ${country}.

For each destination, produce 3-6 cost line items that cover major spend categories (accommodation, key activities, food, local transport, other notable expenses). Use realistic per-trip totals. Amounts should be in the local currency specified for each destination.

Return a single JSON array. Each element must follow exactly:
{
  "destination_id": "<match the Destination ID>",
  "notes": "<optional high-level notes>",
  "costs": [
    {
      "category": "accommodation|activity|food|transport|other",
      "description": "<short human-friendly label>",
      "amount": 0.0,
      "currency": "<local currency code>",
      "date": "YYYY-MM-DD",
      "status": "estimated",
      "source": "ai_estimate",
      "notes": "<optional detail>"
    }
  ]
}

Destinations to cover:

${destinationBlocks}

IMPORTANT: Return ONLY the JSON array, no markdown formatting, no explanation text, no code fences. Just the raw JSON array starting with [ and ending with ].`;
  }

  private parseAICostResponse(responseText: string, destinations: any[]): any[] {
    // Try to extract JSON from the response
    let jsonText = responseText.trim();

    // Remove markdown code fences if present
    jsonText = jsonText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');

    // Try to find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response text:', responseText);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI response is not an array');
    }

    // Transform the parsed data into costs format
    const allCosts: any[] = [];

    parsed.forEach((destData: any) => {
      const costs = destData.costs || [];
      costs.forEach((cost: any) => {
        const destId = String(destData.destination_id);
        const destination = destinations.find(d => String(d.id) === destId);

        if (!destination) {
          console.warn(`Destination ${destId} not found in provided destinations`);
          return;
        }

        // Ensure currency is set properly
        const currency = cost.currency || destination.localCurrency || 'USD';

        // Generate cost ID
        const costId = `${destId}_${cost.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Calculate amount_usd if currency is not USD
        let amountUsd = cost.amount;
        if (currency !== 'USD' && this.exchangeRates[currency]) {
          amountUsd = cost.amount / this.exchangeRates[currency];
        }

        allCosts.push({
          id: costId,
          destination_id: destData.destination_id,
          category: cost.category || 'other',
          description: cost.description || 'AI Generated Cost',
          amount: Math.round(cost.amount || 0),
          currency: currency,
          amount_usd: Math.round(amountUsd),
          date: cost.date || new Date().toISOString().split('T')[0],
          status: cost.status || 'estimated',
          notes: cost.notes || destData.notes || '',
          source: 'ai_estimate'
        });
      });
    });

    return allCosts;
  }

  private async showPromptEditModal(prompt: string, title: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.className = 'prompt-edit-modal-overlay';
      modal.innerHTML = `
        <div class="prompt-edit-modal">
          <div class="prompt-edit-header">
            <h3>${title}</h3>
            <button class="close-modal-btn">×</button>
          </div>
          <div class="prompt-edit-body">
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">Review and edit the prompt before sending to AI:</p>
            <textarea class="prompt-edit-textarea">${prompt}</textarea>
          </div>
          <div class="prompt-edit-footer">
            <button class="btn-secondary cancel-prompt-btn">Cancel</button>
            <button class="btn-primary generate-with-prompt-btn">Generate Costs</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const textarea = modal.querySelector('.prompt-edit-textarea') as HTMLTextAreaElement;
      const closeBtn = modal.querySelector('.close-modal-btn');
      const cancelBtn = modal.querySelector('.cancel-prompt-btn');
      const generateBtn = modal.querySelector('.generate-with-prompt-btn');

      const cleanup = () => {
        modal.remove();
      };

      closeBtn?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      generateBtn?.addEventListener('click', () => {
        const editedPrompt = textarea.value;
        cleanup();
        resolve(editedPrompt);
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  private getCurrenciesForCountry(country: string): string[] {
    const countryCosts = (this.tripData.costs || [])
      .filter(c => {
        const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
        return location?.country === country;
      });

    const currencies = new Set<string>();
    countryCosts.forEach(cost => {
      if (cost.currency && cost.currency !== 'USD') {
        currencies.add(cost.currency);
      }
    });

    return Array.from(currencies);
  }

  private getAllCurrencies(): string[] {
    const currencies = new Set<string>();
    (this.tripData.costs || []).forEach(cost => {
      if (cost.currency && cost.currency !== 'USD') {
        currencies.add(cost.currency);
      }
    });
    return Array.from(currencies);
  }

  private updateExchangeRateDisplays(country?: string) {
    // Update exchange rate displays without full re-render
    const costs = country
      ? (this.tripData.costs || []).filter(c => {
          const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
          return location?.country === country;
        })
      : (this.tripData.costs || []);

    costs.forEach(cost => {
      const currency = cost.currency || 'USD';
      if (currency === 'USD') return;

      const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
      const row = this.container.querySelector(`.editable-cost-row[data-cost-id="${costId}"]`);

      if (row) {
        const rateInfo = row.querySelector('.exchange-rate-info');
        const rate = this.exchangeRates[currency] || 1;

        if (rateInfo) {
          rateInfo.innerHTML = `1 ${currency} = $${(1 / rate).toFixed(4)} USD<br><span class="rate-date">${this.ratesFetchDate}</span>`;
        }
      }
    });
  }

  private convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;

    // Convert to USD first, then to target currency
    const amountInUSD = fromCurrency === 'USD'
      ? amount
      : amount / (this.exchangeRates[fromCurrency] || 1);

    const result = toCurrency === 'USD'
      ? amountInUSD
      : amountInUSD * (this.exchangeRates[toCurrency] || 1);

    return result;
  }

  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$',
      CNY: '¥',
      INR: '₹',
      THB: '฿',
      VND: '₫',
      FJD: 'FJ$',
      SGD: 'S$',
      NZD: 'NZ$'
    };
    return symbols[currency] || currency;
  }

  private formatCurrencyAmount(amount: number, currency: string): string {
    const symbol = this.getCurrencySymbol(currency);
    const rounded = Math.round(amount);
    return `${symbol}${rounded.toLocaleString()}`;
  }

  updateData(tripData: TripData, budget?: TripBudget) {
    // Save the current open/closed state of country sections before re-rendering
    const openCountries = new Set<string>();
    this.container.querySelectorAll('.item-costs-section').forEach(section => {
      const country = (section as HTMLElement).dataset.country;
      const display = (section as HTMLElement).style.display;
      if (country && display !== 'none') {
        openCountries.add(country);
      }
    });

    this.tripData = tripData;
    if (budget !== undefined) {
      this.budget = budget;
    }
    this.render();

    // Restore the open/closed state after rendering
    openCountries.forEach(country => {
      const section = this.container.querySelector(`.item-costs-section[data-country="${country}"]`) as HTMLElement;
      if (section) {
        section.style.display = 'block';

        // Auto-resize all textareas in restored sections
        section.querySelectorAll('textarea.auto-resize').forEach(textarea => {
          const el = textarea as HTMLTextAreaElement;
          requestAnimationFrame(() => {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          });
        });
      }
    });
  }

  private formatCurrency(amount: number): string {
    return `$${Math.round(amount).toLocaleString()}`;
  }

  private getAlertIcon(type: string): string {
    switch (type) {
      case 'exceeded': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  }

  private getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'flight': '#3498db',
      'accommodation': '#e74c3c',
      'activity': '#9b59b6',
      'food': '#f39c12',
      'transport': '#1abc9c',
      'education': '#2ecc71',
      'educational_materials': '#27ae60',
      'educational_activities': '#16a085',
      'other': '#95a5a6'
    };
    return colors[category] || '#95a5a6';
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'flight': '✈️',
      'accommodation': '🏨',
      'activity': '🎯',
      'food': '🍽️',
      'transport': '🚗',
      'education': '📚',
      'educational_materials': '📖',
      'educational_activities': '🎓',
      'other': '📦'
    };
    return icons[category] || '📦';
  }

  private renderCostsTableForCountry(country: string): string {
    const countryCosts = (this.tripData.costs || [])
      .filter(c => {
        const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
        return location?.country === country;
      });

    // Get destinations for this country to allow adding new costs
    const countryDestinations = (this.tripData.locations || [])
      .filter(loc => loc.country === country);

    const hasChanges = Array.from(this.editedCosts.values()).some(cost => {
      const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
      return location?.country === country;
    });

    if (countryCosts.length === 0) {
      const destinationCount = countryDestinations.length;
      const destinationLabel = destinationCount === 1 ? `${destinationCount} destination` : `${destinationCount} destinations`;

      return `
        <div class="no-costs-container">
          <div class="no-costs-message">
            <p style="margin: 0 0 12px 0;">No costs recorded for this country yet.</p>
            <button class="btn-primary generate-costs-btn" data-country="${country}" data-destinations="${countryDestinations.map(d => d.id).join(',')}">
              🤖 Generate AI Cost Estimates for ${destinationLabel}
            </button>
            <p style="margin: 12px 0 0 0; font-size: 13px; color: #666;">
              Or add costs manually below
            </p>
          </div>
          ${this.renderAddCostSection(country, countryDestinations)}
        </div>
      `;
    }

    // Group costs by destination
    const costsByDestination: Record<string, any[]> = {};
    countryCosts.forEach(cost => {
      const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
      const destName = location?.name || location?.city || 'Unknown';
      if (!costsByDestination[destName]) {
        costsByDestination[destName] = [];
      }
      costsByDestination[destName].push(cost);
    });

    const countryCurrencies = this.getCurrenciesForCountry(country);
    const hasCurrencies = countryCurrencies.length > 0;

    // Build exchange rate display for all currencies used in this country
    const ratesDisplay = countryCurrencies.length > 0
      ? countryCurrencies.map(curr => {
          const rate = this.exchangeRates[curr] || 1;
          return `<span class="currency-rate-item">1 ${curr} = $${(1 / rate).toFixed(4)} USD</span>`;
        }).join(' • ')
      : '';

    return `
      <div class="country-costs-table" data-country="${country}">
        <div class="costs-table-actions">
          <button class="btn-sm btn-success add-cost-btn" data-country="${country}">+ Add Cost</button>
          ${hasCurrencies ? `
            <button class="btn-sm btn-secondary refresh-country-rates-btn" data-country="${country}" title="Refresh exchange rates for ${countryCurrencies.join(', ')}">
              🔄 Refresh Rates (${countryCurrencies.join(', ')})
            </button>
          ` : ''}
          <button class="btn-sm btn-secondary regenerate-country-costs-btn" data-country="${country}" data-destinations="${countryDestinations.map(d => d.id).join(',')}" title="Regenerate all costs for this country">
            🔄 Regenerate Costs
          </button>
          <span class="auto-save-indicator"></span>
        </div>
        ${ratesDisplay ? `
          <div class="exchange-rates-header">
            <strong>Exchange Rates:</strong> ${ratesDisplay} <span class="rates-date-small">(${this.ratesFetchDate})</span>
          </div>
        ` : ''}
        ${Object.entries(costsByDestination).map(([destName, costs]) => {
          const firstCost = costs[0];
          const destinationId = firstCost?.destination_id;
          return `
          <div class="destination-costs-section" data-destination-id="${destinationId}">
            <div class="destination-header">
              <span>${destName}</span>
              <button class="btn-xs btn-secondary regenerate-destination-costs-btn"
                      data-destination-id="${destinationId}"
                      data-destination-name="${destName}"
                      title="Regenerate costs for ${destName}">
                🔄 Regenerate
              </button>
            </div>
            <table class="costs-table editable-costs-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Category</th>
                  <th style="width: 200px;">Description</th>
                  <th style="width: 80px;">Currency</th>
                  <th style="width: 100px;" class="text-right">Amount</th>
                  <th style="width: 100px;" class="text-right">USD</th>
                  <th style="width: 120px;">Status</th>
                  <th style="width: 110px;">Date</th>
                  <th style="width: 200px;">Notes</th>
                  <th style="width: 60px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${costs.map(cost => this.renderEditableCostRow(cost)).join('')}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="4"><strong>Subtotal for ${destName}</strong></td>
                  <td class="text-right"><strong>${this.formatCurrency(
                    costs.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0)
                  )}</strong></td>
                  <td colspan="4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
        }).join('')}
        <div class="country-total-row" data-country="${country}">
          <strong>Total for ${country}:</strong>
          <strong class="country-total-amount">${this.formatCurrency(
            countryCosts.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0)
          )}</strong>
        </div>
        ${this.renderAddCostSection(country, countryDestinations)}
      </div>
    `;
  }

  private renderEditableCostRow(cost: any): string {
    const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
    const amount = cost.amount || 0;
    const amountUsd = cost.amount_usd || amount;
    // Default to local currency if not set
    const currency = cost.currency || getCurrencyForDestination(cost.destination_id, this.tripData.locations || []);

    return `
      <tr class="editable-cost-row" data-cost-id="${costId}">
        <td>
          <span class="category-badge" style="background-color: ${this.getCategoryColor(cost.category || 'other')}">
            ${this.getCategoryIcon(cost.category || 'other')} ${(cost.category || 'other').replace(/_/g, ' ')}
          </span>
        </td>
        <td>
          <input type="text"
                 class="cost-field-input"
                 data-cost-id="${costId}"
                 data-field="description"
                 value="${cost.description || ''}"
                 placeholder="Description">
        </td>
        <td>
          <div class="currency-display-wrapper">
            <div class="currency-code-display">${currency}</div>
          </div>
          <input type="hidden"
                 class="currency-field"
                 data-cost-id="${costId}"
                 data-field="currency"
                 value="${currency}">
        </td>
        <td class="text-right">
          <div class="currency-input-wrapper">
            <span class="currency-symbol">${this.getCurrencySymbol(currency)}</span>
            <input type="number"
                   class="cost-field-input amount-input"
                   data-cost-id="${costId}"
                   data-field="amount"
                   value="${Math.round(amount)}"
                   step="1"
                   min="0">
          </div>
        </td>
        <td class="text-right">
          <div class="currency-input-wrapper">
            <span class="currency-symbol">$</span>
            <input type="number"
                   class="cost-field-input usd-input"
                   data-cost-id="${costId}"
                   data-field="amount_usd"
                   value="${Math.round(amountUsd)}"
                   step="1"
                   min="0"
                   ${currency === 'USD' ? 'disabled' : ''}>
          </div>
        </td>
        <td>
          <select class="cost-field-select status-select"
                  data-cost-id="${costId}"
                  data-field="status">
            <option value="estimated" ${(cost.status || 'estimated') === 'estimated' ? 'selected' : ''}>Estimated</option>
            <option value="researched" ${cost.status === 'researched' ? 'selected' : ''}>Researched</option>
            <option value="booked" ${cost.status === 'booked' ? 'selected' : ''}>Booked</option>
            <option value="paid" ${cost.status === 'paid' ? 'selected' : ''}>Paid</option>
          </select>
        </td>
        <td>
          <input type="date"
                 class="cost-field-input date-input"
                 data-cost-id="${costId}"
                 data-field="date"
                 value="${cost.date || ''}">
        </td>
        <td>
          <textarea class="cost-field-input notes-input auto-resize"
                    data-cost-id="${costId}"
                    data-field="notes"
                    placeholder="Notes"
                    rows="1">${cost.notes || ''}</textarea>
        </td>
        <td>
          <button class="btn-icon delete-cost-btn" data-cost-id="${costId}" title="Delete cost">🗑️</button>
        </td>
      </tr>
    `;
  }

  private renderAddCostSection(country: string, destinations: any[]): string {
    return `
      <div class="add-cost-section" data-country="${country}" style="display: none;">
        <div class="add-cost-form">
          <h5>Add New Cost for ${country}</h5>
          <div class="form-row">
            <div class="form-group">
              <label>Destination</label>
              <select class="new-cost-field" data-field="destination_id">
                <option value="">Select destination...</option>
                ${destinations.map(dest =>
                  `<option value="${dest.id}">${dest.name || dest.city}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select class="new-cost-field" data-field="category">
                <option value="accommodation">🏨 Accommodation</option>
                <option value="food">🍽️ Food</option>
                <option value="transport">🚗 Transport</option>
                <option value="activity">🎯 Activity</option>
                <option value="flight">✈️ Flight</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Description</label>
              <input type="text" class="new-cost-field" data-field="description" placeholder="Description">
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select class="new-cost-field new-cost-currency" data-field="currency">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="CNY">CNY</option>
                <option value="INR">INR</option>
                <option value="THB">THB</option>
                <option value="VND">VND</option>
                <option value="FJD">FJD</option>
                <option value="SGD">SGD</option>
                <option value="NZD">NZD</option>
              </select>
            </div>
            <div class="form-group">
              <label>Amount</label>
              <input type="number" class="new-cost-field new-cost-amount" data-field="amount" step="0.01" min="0" value="0">
            </div>
            <div class="form-group">
              <label>Amount (USD)</label>
              <input type="number" class="new-cost-field new-cost-usd" data-field="amount_usd" step="0.01" min="0" value="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select class="new-cost-field" data-field="status">
                <option value="estimated">Estimated</option>
                <option value="researched">Researched</option>
                <option value="booked">Booked</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="new-cost-field" data-field="date">
            </div>
            <div class="form-group">
              <label>Notes</label>
              <input type="text" class="new-cost-field" data-field="notes" placeholder="Notes">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-sm btn-primary save-new-cost-btn" data-country="${country}">Save New Cost</button>
            <button class="btn-sm btn-secondary cancel-new-cost-btn" data-country="${country}">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderCategoryBreakdown(costs: Array<{category?: string, amount?: number, amount_usd?: number}>): string {
    const categoryTotals: Record<string, number> = {};
    let total = 0;

    costs.forEach(cost => {
      const cat = cost.category || 'other';
      const amount = cost.amount_usd || cost.amount || 0;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      total += amount;
    });

    if (total === 0) return '';

    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => {
        const pct = (amount / total) * 100;
        const color = this.getCategoryColor(cat);
        return `<div class="cat-breakdown-item" style="background-color: ${color}" title="${cat.replace(/_/g, ' ')}: ${this.formatCurrency(amount)} (${pct.toFixed(0)}%)"></div>`;
      })
      .join('');
  }

  private renderNoBudget(): string {
    const totalCosts = (this.tripData.costs || [])
      .reduce((sum, cost) => sum + (cost.amount_usd || cost.amount || 0), 0);

    return `
      <div class="budget-manager no-budget">
        <div class="budget-header">
          <h3>💰 Budget Management</h3>
          <p class="budget-subtitle">No budget set for this trip</p>
        </div>

        <div class="current-spending">
          <div class="spending-summary">
            <div class="spending-label">Current Total Spending</div>
            <div class="spending-amount">${this.formatCurrency(totalCosts)}</div>
          </div>
        </div>

        <div class="budget-actions">
          <button class="btn-primary" id="create-budget-btn">
            Create Budget (+10% Contingency)
          </button>
          <button class="btn-secondary" id="custom-budget-btn">
            Set Custom Budget
          </button>
        </div>

        <div class="budget-help">
          <p>💡 <strong>Tip:</strong> Setting a budget helps you track spending and receive alerts when approaching limits.</p>
        </div>
      </div>
    `;
  }

  private renderBudgetStatus(): string {
    if (!this.budget) return this.renderNoBudget();

    const status = calculateBudgetStatus(this.budget, this.tripData);
    const progressBarClass = status.percentage_used > 100 ? 'over-budget' :
                            status.percentage_used > 90 ? 'warning' :
                            status.percentage_used > 80 ? 'caution' : '';
    const progressWidth = Math.min(status.percentage_used, 100);

    // Get all categories and countries from trip data
    const categories = new Set<string>();
    const countries = new Set<string>();

    (this.tripData.costs || []).forEach(cost => {
      if (cost.category) categories.add(cost.category);
    });

    (this.tripData.locations || []).forEach(loc => {
      if (loc.country) countries.add(loc.country);
    });

    const currentBudget = this.budget.total_budget_usd || 0;
    const allCurrencies = this.getAllCurrencies();
    const hasAnyCurrencies = allCurrencies.length > 0;

    return `
      <div class="budget-manager integrated">
        <div class="budget-header-compact">
          <div class="header-row">
            <h3>💰 Budget Management</h3>
            <div class="header-actions">
              ${hasAnyCurrencies ? `
                <button class="btn-secondary-sm" id="refresh-all-rates-btn" title="Refresh all exchange rates (${allCurrencies.join(', ')})">
                  🔄 Refresh All Rates
                </button>
              ` : ''}
              <button class="btn-primary-sm" id="save-budget-btn">💾 Save</button>
            </div>
          </div>
          <div class="budget-overview-compact">
            <div class="budget-field">
              <label>Total:</label>
              <input type="number" id="total-budget" value="${currentBudget}" min="0" step="100">
              <span>USD</span>
            </div>
            <div class="budget-field">
              <label>Contingency:</label>
              <input type="number" id="contingency-pct" value="${this.budget.contingency_pct || 0}" min="0" max="100" step="1">
              <span>%</span>
            </div>
            <div class="budget-stat">
              <span class="stat-label">Estimated:</span>
              <span class="stat-value ${progressBarClass}">${this.formatCurrency(status.total_spent)} <span class="stat-pct">(${status.percentage_used.toFixed(1)}%)</span></span>
            </div>
            <div class="budget-stat">
              <span class="stat-label">Remaining:</span>
              <span class="stat-value ${status.total_remaining < 0 ? 'negative' : 'positive'}">
                ${this.formatCurrency(status.total_remaining)}
              </span>
            </div>
          </div>
          <div class="budget-progress-compact">
            <div class="progress-bar ${progressBarClass}">
              <div class="progress-fill" style="width: ${progressWidth}%"></div>
            </div>
          </div>
        </div>

        <!-- Alerts -->
        ${status.alerts.length > 0 ? `
          <div class="budget-alerts">
            <h4>🔔 Alerts</h4>
            ${status.alerts.map(alert => `
              <div class="budget-alert alert-${alert.type}">
                <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
                <span class="alert-message">${alert.message}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Budget by Country -->
        ${countries.size > 0 ? `
          <div class="budget-edit-section">
            <div class="section-header">
              <h4>🌍 Budget by Country</h4>
              <div class="mode-controls">
                <span class="mode-indicator" id="country-mode-indicator">Mode: Dollar Amounts</span>
                <div class="country-mode-selector">
                  <button class="mode-btn active" data-mode="dollars" id="country-mode-dollars">$</button>
                  <button class="mode-btn" data-mode="percent" id="country-mode-percent">%</button>
                  <button class="mode-btn" data-mode="perday" id="country-mode-perday">$/day</button>
                </div>
              </div>
            </div>

            <!-- Group note for countries -->
            <div class="group-note-section">
              <label class="note-label">📝 Country Budget Notes:</label>
              <textarea class="group-note-input"
                        id="country-group-note"
                        placeholder="Add notes about country budgeting strategy..."
                        rows="2">${this.budget?.country_group_note || ''}</textarea>
            </div>

            <!-- Always-visible budget summary for countries -->
            <div class="budget-summary-box">
              <div class="summary-row">
                <span class="summary-label">Total Budget:</span>
                <span class="summary-value" id="country-total-budget">${this.formatCurrency(currentBudget)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Allocated to Countries:</span>
                <span class="summary-value" id="country-total-allocated">${this.formatCurrency(
                  Array.from(countries).reduce((sum, country) => {
                    return sum + (this.budget?.budgets_by_country?.[country] || 0);
                  }, 0)
                )}</span>
                <span class="summary-percentage" id="country-total-pct">${currentBudget > 0 ?
                  ((Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Unallocated:</span>
                <span class="summary-value" id="country-unallocated">${this.formatCurrency(
                  currentBudget - Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0)
                )}</span>
              </div>
            </div>

            <div id="country-allocation-status" style="display: none;" class="allocation-status">
              <div class="allocation-info">
                <strong>Total Allocated:</strong> <span id="country-total-allocated-pct">0</span>%
              </div>
              <div id="country-allocation-remainder" class="allocation-remainder"></div>
            </div>

            <div class="budget-items-edit">
              ${Array.from(countries).map(country => {
                const countryDays = (this.tripData.locations || [])
                  .filter(loc => loc.country === country)
                  .reduce((sum, loc) => sum + (loc.duration_days || 0), 0);

                const countryCostsArray = (this.tripData.costs || [])
                  .filter(c => {
                    const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                    return location?.country === country;
                  });

                // Get destinations for this country for the Generate Costs button
                const countryDestinations = (this.tripData.locations || [])
                  .filter(loc => loc.country === country);

                const countryCosts = countryCostsArray.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
                const categoryBreakdown = this.renderCategoryBreakdown(countryCostsArray);

                const countryBudget = this.budget?.budgets_by_country?.[country] || countryCosts * 1.1;
                const budgetPerDay = countryDays > 0 ? countryBudget / countryDays : 0;
                const countryPct = currentBudget > 0 ? (countryBudget / currentBudget * 100) : 0;
                const pct = status.by_country[country]?.percentage || 0;
                const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
                const countryNote = this.budget?.country_notes?.[country] || '';

                // Determine which button to show: Generate Costs or View Costs
                const hasCosts = countryCostsArray.length > 0;
                const destinationLabel = countryDestinations.length === 1
                  ? '1 destination'
                  : `${countryDestinations.length} destinations`;

                const costsButton = hasCosts
                  ? `<button class="costs-toggle-btn" data-country="${country}" title="View Costs">
                       💰 View Costs (${countryCostsArray.length})
                     </button>`
                  : `<button class="generate-costs-btn inline-generate-btn"
                             data-country="${country}"
                             data-destinations="${countryDestinations.map(d => d.id).join(',')}"
                             title="Generate AI cost estimates">
                       🤖 Generate Costs (${destinationLabel})
                     </button>`;

                return `
                  <div class="budget-item-edit">
                    <div class="item-header-row">
                      <div class="item-label-with-note">
                        <span class="item-label-text">${country} <span class="days-label">(${countryDays} day${countryDays !== 1 ? 's' : ''})</span></span>
                        <button class="note-toggle-btn" data-country="${country}" title="${countryNote ? 'Edit Note' : 'Add Note'}">
                          ${countryNote ? '📝' : '📄'}
                        </button>
                        ${countryNote ? `<span class="inline-note">${countryNote}</span>` : ''}
                        ${costsButton}
                      </div>
                    </div>
                    <div class="item-input-row">
                      <div class="input-with-unit">
                        <input type="number"
                               class="country-input"
                               data-country="${country}"
                               data-days="${countryDays}"
                               data-dollar-value="${Math.round(countryBudget)}"
                               value="${Math.round(countryBudget)}"
                               min="0"
                               step="10">
                        <span class="input-unit" data-country="${country}">USD</span>
                      </div>
                      <span class="calc-arrow">→</span>
                      <div class="calculated-display">
                        <span class="calc-value" data-country="${country}">${countryPct.toFixed(1)}%</span>
                      </div>
                      <div class="item-status">
                        <span class="country-per-day-display" data-country="${country}">$${Math.round(budgetPerDay)}/day</span>
                        <div class="est-cost-with-breakdown">
                          <span class="current-spend">Est: ${this.formatCurrency(countryCosts)}</span>
                          ${categoryBreakdown ? `<div class="cat-breakdown-bar">${categoryBreakdown}</div>` : ''}
                        </div>
                        <div class="mini-progress-bar ${barClass}">
                          <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                        </div>
                      </div>
                    </div>
                    <div class="item-note-section" data-country="${country}" style="display: none">
                      <textarea class="item-note-input"
                                data-country="${country}"
                                placeholder="Add notes about this country budget..."
                                rows="2">${countryNote}</textarea>
                    </div>
                    <div class="item-costs-section" data-country="${country}" style="display: none">
                      ${this.renderCostsTableForCountry(country)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Budget by Category -->
        <div class="budget-edit-section">
          <div class="section-header">
            <h4>📊 Budget by Category</h4>
            <div class="mode-controls">
              <span class="mode-indicator" id="category-mode-indicator">Mode: Dollar Amounts</span>
              <label class="toggle-switch">
                <input type="checkbox" id="category-mode-toggle">
                <span class="toggle-slider"></span>
                <span class="toggle-label">Use %</span>
              </label>
            </div>
          </div>

          <!-- Group note for categories -->
          <div class="group-note-section">
            <label class="note-label">📝 Category Budget Notes:</label>
            <textarea class="group-note-input"
                      id="category-group-note"
                      placeholder="Add notes about category budgeting strategy..."
                      rows="2">${this.budget?.category_group_note || ''}</textarea>
          </div>

          <!-- Always-visible budget summary -->
          <div class="budget-summary-box">
            <div class="summary-row">
              <span class="summary-label">Total Budget:</span>
              <span class="summary-value" id="category-total-budget">${this.formatCurrency(currentBudget)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Allocated to Categories:</span>
              <span class="summary-value" id="category-total-allocated">${this.formatCurrency(
                Array.from(categories).reduce((sum, cat) => {
                  return sum + (this.budget?.budgets_by_category?.[cat] || 0);
                }, 0)
              )}</span>
              <span class="summary-percentage" id="category-total-pct">${currentBudget > 0 ?
                ((Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Unallocated:</span>
              <span class="summary-value" id="category-unallocated">${this.formatCurrency(
                currentBudget - Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0)
              )}</span>
            </div>
          </div>

          <div id="allocation-status" style="display: none;" class="allocation-status">
            <div class="allocation-info">
              <strong>Total Allocated:</strong> <span id="total-allocated-pct">0</span>%
            </div>
            <div id="allocation-remainder" class="allocation-remainder"></div>
          </div>

          <div class="budget-items-edit">
            ${Array.from(categories).map(cat => {
              const catCosts = (this.tripData.costs || [])
                .filter(c => c.category === cat)
                .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
              const catBudget = this.budget?.budgets_by_category?.[cat] || catCosts * 1.1;
              const catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
              const pct = status.by_category[cat]?.percentage || 0;
              const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';

              const catNote = this.budget?.category_notes?.[cat] || '';
              return `
                <div class="budget-item-edit">
                  <div class="item-header-row">
                    <div class="item-label-with-note">
                      <span class="item-label-text">${cat.replace(/_/g, ' ')}</span>
                      <button class="note-toggle-btn" data-category="${cat}" title="${catNote ? 'Edit Note' : 'Add Note'}">
                        ${catNote ? '📝' : '📄'}
                      </button>
                      ${catNote ? `<span class="inline-note">${catNote}</span>` : ''}
                    </div>
                  </div>
                  <div class="item-input-row">
                    <div class="input-with-unit">
                      <input type="number"
                             class="cat-input"
                             data-category="${cat}"
                             data-dollar-value="${Math.round(catBudget)}"
                             value="${Math.round(catBudget)}"
                             min="0"
                             step="10">
                      <span class="input-unit" data-category="${cat}">USD</span>
                    </div>
                    <span class="calc-arrow">→</span>
                    <div class="calculated-display">
                      <span class="calc-value" data-category="${cat}">${catPct.toFixed(1)}%</span>
                    </div>
                    <div class="item-status">
                      <span class="current-spend">Est: ${this.formatCurrency(catCosts)}</span>
                      <div class="mini-progress-bar ${barClass}">
                        <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                      </div>
                    </div>
                  </div>
                  <div class="item-note-section" data-category="${cat}" style="display: none">
                    <textarea class="item-note-input"
                              data-category="${cat}"
                              placeholder="Add notes about this category budget..."
                              rows="2">${catNote}</textarea>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="budget-footer">
          <button class="btn-primary" id="save-budget-btn-footer">💾 Save Budget</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners() {
    // Create budget button
    const createBtn = this.container.querySelector('#create-budget-btn');
    createBtn?.addEventListener('click', () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    });

    // Custom budget button
    const customBtn = this.container.querySelector('#custom-budget-btn');
    customBtn?.addEventListener('click', () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    });

    // If budget exists, attach integrated edit listeners
    if (this.budget) {
      this.attachBudgetEditListeners();
    }
  }

  private attachBudgetEditListeners() {
    const totalBudgetInput = this.container.querySelector('#total-budget') as HTMLInputElement;
    const contingencyInput = this.container.querySelector('#contingency-pct') as HTMLInputElement;

    if (!totalBudgetInput) return;

    // Category mode toggle logic
    const categoryModeToggle = this.container.querySelector('#category-mode-toggle') as HTMLInputElement;
    const categoryModeIndicator = this.container.querySelector('#category-mode-indicator') as HTMLElement;
    const allocationStatus = this.container.querySelector('#allocation-status') as HTMLElement;
    const totalAllocatedSpan = this.container.querySelector('#total-allocated-pct') as HTMLElement;
    const allocationRemainder = this.container.querySelector('#allocation-remainder') as HTMLElement;

    let isPercentageMode = false;

    // Update budget summary for categories
    const updateCategorySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const categoryTotalBudgetEl = this.container.querySelector('#category-total-budget') as HTMLElement;
      const categoryTotalEl = this.container.querySelector('#category-total-allocated') as HTMLElement;
      const categoryPctEl = this.container.querySelector('#category-total-pct') as HTMLElement;
      const categoryUnallocatedEl = this.container.querySelector('#category-unallocated') as HTMLElement;

      // Update total budget display
      if (categoryTotalBudgetEl) {
        categoryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
      }

      if (categoryTotalEl) {
        categoryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (categoryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        categoryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          categoryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          categoryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          categoryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (categoryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        categoryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          categoryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          categoryUnallocatedEl.style.color = '#dc3545';
        } else {
          categoryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for categories
    const updateCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-category="${category}"]`) as HTMLElement;

        if (isPercentageMode) {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          el.dataset.dollarValue = dollars.toString();
        } else {
          const dollars = parseFloat(el.value) || 0;
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          calcValueSpan.textContent = `${pct.toFixed(1)}%`;
          el.dataset.dollarValue = dollars.toString();
        }
      });

      if (isPercentageMode) {
        updateAllocationStatus();
      }

      updateCategorySummary();
    };

    // Update allocation status for categories
    const updateAllocationStatus = () => {
      let totalPct = 0;
      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      totalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        allocationRemainder.textContent = '✓ Fully Allocated';
        allocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        allocationRemainder.style.color = '#ffc107';
      } else {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        allocationRemainder.style.color = '#dc3545';
      }
    };

    // Category toggle between % and $
    categoryModeToggle?.addEventListener('change', () => {
      isPercentageMode = categoryModeToggle.checked;
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      categoryModeIndicator.textContent = isPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
      allocationStatus.style.display = isPercentageMode ? 'block' : 'none';

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const unitSpan = this.container.querySelector(`.input-unit[data-category="${category}"]`) as HTMLElement;
        const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

        if (isPercentageMode) {
          const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
          el.value = pct.toFixed(1);
          el.step = '0.1';
          el.max = '100';
          unitSpan.textContent = '%';
        } else {
          el.value = Math.round(currentDollarValue).toString();
          el.step = '10';
          el.removeAttribute('max');
          unitSpan.textContent = 'USD';
        }
      });

      updateCalculatedDisplays();
    });

    // Update category displays when inputs change
    this.container.querySelectorAll('.cat-input').forEach(input => {
      input.addEventListener('input', () => {
        updateCalculatedDisplays();
      });
    });

    // Update when total budget changes
    totalBudgetInput.addEventListener('input', () => {
      updateCalculatedDisplays();
      updateCountryCalculatedDisplays();
    });

    // Country mode selector logic
    const countryModeIndicator = this.container.querySelector('#country-mode-indicator') as HTMLElement;
    const countryAllocationStatus = this.container.querySelector('#country-allocation-status') as HTMLElement;
    const countryTotalAllocatedSpan = this.container.querySelector('#country-total-allocated-pct') as HTMLElement;
    const countryAllocationRemainder = this.container.querySelector('#country-allocation-remainder') as HTMLElement;

    let countryMode: 'dollars' | 'percent' | 'perday' = 'dollars';

    // Update budget summary for countries
    const updateCountrySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const countryTotalBudgetEl = this.container.querySelector('#country-total-budget') as HTMLElement;
      const countryTotalEl = this.container.querySelector('#country-total-allocated') as HTMLElement;
      const countryPctEl = this.container.querySelector('#country-total-pct') as HTMLElement;
      const countryUnallocatedEl = this.container.querySelector('#country-unallocated') as HTMLElement;

      // Update total budget display
      if (countryTotalBudgetEl) {
        countryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
      }

      if (countryTotalEl) {
        countryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (countryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        countryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          countryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          countryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          countryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (countryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        countryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          countryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          countryUnallocatedEl.style.color = '#dc3545';
        } else {
          countryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for countries
    const updateCountryCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const days = parseFloat(el.dataset.days!) || 1;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-country="${country}"]`) as HTMLElement;
        const perDayDisplay = this.container.querySelector(`.country-per-day-display[data-country="${country}"]`) as HTMLElement;

        if (countryMode === 'percent') {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        } else if (countryMode === 'perday') {
          const perDay = parseFloat(el.value) || 0;
          const dollars = Math.round(perDay * days);
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          perDayDisplay.textContent = `${pct.toFixed(1)}%`;
          el.dataset.dollarValue = dollars.toString();
        } else {
          const dollars = parseFloat(el.value) || 0;
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `${pct.toFixed(1)}%`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        }
      });

      if (countryMode === 'percent') {
        updateCountryAllocationStatus();
      }

      updateCountrySummary();
    };

    // Update allocation status for countries
    const updateCountryAllocationStatus = () => {
      let totalPct = 0;
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      countryTotalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        countryAllocationRemainder.textContent = '✓ Fully Allocated';
        countryAllocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        countryAllocationRemainder.style.color = '#ffc107';
      } else {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        countryAllocationRemainder.style.color = '#dc3545';
      }
    };

    // Country mode selector buttons
    const countryModeBtns = this.container.querySelectorAll('.country-mode-selector .mode-btn');
    countryModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = (btn as HTMLElement).dataset.mode as 'dollars' | 'percent' | 'perday';
        countryMode = newMode;
        const totalBudget = parseFloat(totalBudgetInput.value) || 0;

        // Update button states
        countryModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update indicator
        const modeText = newMode === 'dollars' ? 'Dollar Amounts' : newMode === 'percent' ? 'Percentages' : 'Per Day';
        countryModeIndicator.textContent = `Mode: ${modeText}`;
        countryAllocationStatus.style.display = newMode === 'percent' ? 'block' : 'none';

        // Convert all inputs to new mode
        this.container.querySelectorAll('.country-input').forEach(input => {
          const el = input as HTMLInputElement;
          const country = el.dataset.country!;
          const days = parseFloat(el.dataset.days!) || 1;
          const unitSpan = this.container.querySelector(`.input-unit[data-country="${country}"]`) as HTMLElement;
          const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

          if (newMode === 'percent') {
            const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
            el.value = pct.toFixed(1);
            el.step = '0.1';
            el.max = '100';
            unitSpan.textContent = '%';
          } else if (newMode === 'perday') {
            const perDay = days > 0 ? Math.round(currentDollarValue / days) : 0;
            el.value = perDay.toString();
            el.step = '1';
            el.removeAttribute('max');
            unitSpan.textContent = '$/day';
          } else {
            el.value = Math.round(currentDollarValue).toString();
            el.step = '10';
            el.removeAttribute('max');
            unitSpan.textContent = 'USD';
          }
        });

        updateCountryCalculatedDisplays();
      });
    });

    // Update country displays when inputs change
    this.container.querySelectorAll('.country-input').forEach(input => {
      input.addEventListener('input', () => {
        updateCountryCalculatedDisplays();
      });
    });

    // Note toggle functionality for categories
    this.container.querySelectorAll('.note-toggle-btn[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = (btn as HTMLElement).dataset.category!;
        const noteSection = this.container.querySelector(`.item-note-section[data-category="${category}"]`) as HTMLElement;
        if (noteSection) {
          const isVisible = noteSection.style.display !== 'none';
          noteSection.style.display = isVisible ? 'none' : 'block';
        }
      });
    });

    // Note toggle functionality for countries
    this.container.querySelectorAll('.note-toggle-btn[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const noteSection = this.container.querySelector(`.item-note-section[data-country="${country}"]`) as HTMLElement;
        if (noteSection) {
          const isVisible = noteSection.style.display !== 'none';
          noteSection.style.display = isVisible ? 'none' : 'block';
        }
      });
    });

    // Costs toggle functionality for countries
    this.container.querySelectorAll('.costs-toggle-btn[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const costsSection = this.container.querySelector(`.item-costs-section[data-country="${country}"]`) as HTMLElement;
        if (costsSection) {
          const isVisible = costsSection.style.display !== 'none';
          costsSection.style.display = isVisible ? 'none' : 'block';

          // Update button text to indicate state
          const btnElement = btn as HTMLElement;
          if (isVisible) {
            btnElement.innerHTML = btnElement.innerHTML.replace('▼', '▶').replace('Hide', 'View');
          } else {
            btnElement.innerHTML = btnElement.innerHTML.replace('▶', '▼').replace('View', 'Hide');

            // Auto-resize all textareas in this section when opening
            costsSection.querySelectorAll('textarea.auto-resize').forEach(textarea => {
              const el = textarea as HTMLTextAreaElement;
              requestAnimationFrame(() => {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              });
            });
          }
        }
      });
    });

    // Save budget functionality
    const saveBudget = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      const contingency = parseFloat(contingencyInput.value) || 0;

      // Collect category budgets - use stored dollar values
      const budgets_by_category: Record<string, number> = {};
      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_category[category] = dollarValue;
      });

      // Collect country budgets - use stored dollar values
      const budgets_by_country: Record<string, number> = {};
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_country[country] = dollarValue;
      });

      // Collect category notes
      const category_notes: Record<string, string> = {};
      this.container.querySelectorAll('.item-note-input[data-category]').forEach(textarea => {
        const el = textarea as HTMLTextAreaElement;
        const category = el.dataset.category!;
        const note = el.value.trim();
        if (note) {
          category_notes[category] = note;
        }
      });

      // Collect country notes
      const country_notes: Record<string, string> = {};
      this.container.querySelectorAll('.item-note-input[data-country]').forEach(textarea => {
        const el = textarea as HTMLTextAreaElement;
        const country = el.dataset.country!;
        const note = el.value.trim();
        if (note) {
          country_notes[country] = note;
        }
      });

      // Get group notes
      const categoryGroupNote = (this.container.querySelector('#category-group-note') as HTMLTextAreaElement)?.value.trim();
      const countryGroupNote = (this.container.querySelector('#country-group-note') as HTMLTextAreaElement)?.value.trim();

      // Build budget object, only including note fields if they have values
      const newBudget: TripBudget = {
        total_budget_usd: totalBudget,
        budgets_by_category,
        budgets_by_country,
        contingency_pct: contingency,
        alerts: []
      };

      // Only add note fields if they have values (Firestore doesn't accept undefined)
      if (Object.keys(category_notes).length > 0) {
        newBudget.category_notes = category_notes;
      }
      if (Object.keys(country_notes).length > 0) {
        newBudget.country_notes = country_notes;
      }
      if (categoryGroupNote) {
        newBudget.category_group_note = categoryGroupNote;
      }
      if (countryGroupNote) {
        newBudget.country_group_note = countryGroupNote;
      }

      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    };

    // Attach save listeners to both buttons
    this.container.querySelector('#save-budget-btn')?.addEventListener('click', saveBudget);
    this.container.querySelector('#save-budget-btn-footer')?.addEventListener('click', saveBudget);

    // Attach cost editing listeners
    this.attachCostEditingListeners();
  }

  private attachCostEditingListeners() {
    // Inline editing of cost fields - use 'input' for real-time updates
    this.container.querySelectorAll('.cost-field-input, .cost-field-select').forEach(field => {
      const inputEl = field as HTMLInputElement | HTMLSelectElement;

      const handleChange = () => {
        const costId = inputEl.dataset.costId!;
        const fieldName = inputEl.dataset.field!;

        // Find the original cost
        const originalCost = (this.tripData.costs || []).find(c =>
          (c.id || `${c.destination_id}_${c.category}_${Date.now()}`) === costId
        );

        if (!originalCost) return;

        // Get or create edited cost entry
        let editedCost = this.editedCosts.get(costId);
        if (!editedCost) {
          editedCost = { ...originalCost, id: costId };
          this.editedCosts.set(costId, editedCost);
        }

        // Update the field
        if (inputEl.type === 'number') {
          editedCost[fieldName] = parseFloat(inputEl.value) || 0;
        } else {
          editedCost[fieldName] = inputEl.value;
        }

        // Special handling for currency changes
        if (fieldName === 'currency') {
          const currency = inputEl.value;
          const row = inputEl.closest('tr');
          const amountInput = row?.querySelector('.amount-input') as HTMLInputElement;
          const usdInput = row?.querySelector('.usd-input') as HTMLInputElement;
          const currencySymbol = row?.querySelector('.currency-symbol') as HTMLElement;

          if (currencySymbol) {
            currencySymbol.textContent = this.getCurrencySymbol(currency);
          }

          if (currency === 'USD') {
            // Disable USD input and sync with amount
            if (usdInput && amountInput) {
              usdInput.disabled = true;
              usdInput.value = amountInput.value;
              editedCost.amount_usd = parseFloat(amountInput.value) || 0;
            }
          } else {
            // Enable USD input and auto-convert
            if (usdInput && amountInput) {
              usdInput.disabled = false;
              const amount = parseFloat(amountInput.value) || 0;
              const convertedUsd = this.convertCurrency(amount, currency, 'USD');
              usdInput.value = Math.round(convertedUsd).toString();
              editedCost.amount_usd = Math.round(convertedUsd);
            }
          }

          // Update exchange rate display without full re-render
          const rateInfo = row?.querySelector('.exchange-rate-info');
          if (rateInfo && currency !== 'USD') {
            const rate = this.exchangeRates[currency] || 1;
            rateInfo.textContent = `1 USD = ${this.getCurrencySymbol(currency)}${rate.toFixed(2)}`;
            rateInfo.setAttribute('title', `Rate as of ${this.ratesFetchDate}`);
          } else if (rateInfo) {
            rateInfo.textContent = '';
          }
        }

        // If amount changes, auto-convert to USD
        if (fieldName === 'amount') {
          const row = inputEl.closest('tr');
          const currencyField = row?.querySelector('.currency-field') as HTMLInputElement;
          const usdInput = row?.querySelector('.usd-input') as HTMLInputElement;
          const currency = currencyField?.value || editedCost.currency || 'USD';
          const amount = parseFloat(inputEl.value) || 0;

          if (usdInput) {
            if (currency === 'USD') {
              usdInput.value = inputEl.value;
              editedCost.amount_usd = amount;
            } else {
              const convertedUsd = this.convertCurrency(amount, currency, 'USD');
              usdInput.value = Math.round(convertedUsd).toString();
              editedCost.amount_usd = Math.round(convertedUsd);
            }
          }
        }

        // If USD amount changes, reverse calculate original currency amount
        if (fieldName === 'amount_usd') {
          const row = inputEl.closest('tr');
          const currencyField = row?.querySelector('.currency-field') as HTMLInputElement;
          const amountInput = row?.querySelector('.amount-input') as HTMLInputElement;
          const currency = currencyField?.value || editedCost.currency || 'USD';
          const usdAmount = parseFloat(inputEl.value) || 0;

          if (amountInput && currency !== 'USD') {
            const convertedAmount = this.convertCurrency(usdAmount, 'USD', currency);
            amountInput.value = Math.round(convertedAmount).toString();
            editedCost.amount = Math.round(convertedAmount);
          }
        }

        // Schedule auto-save instead of immediate render
        this.scheduleAutoSave();
      };

      // Use 'input' for text/number fields for real-time updates
      if (inputEl.type === 'number' || inputEl.type === 'text' || inputEl.type === 'date') {
        inputEl.addEventListener('input', handleChange);
      } else {
        // Use 'change' for selects
        inputEl.addEventListener('change', handleChange);
      }
    });

    // Auto-resize textareas
    this.setupAutoResizeTextareas();

    // Add cost button
    this.container.querySelectorAll('.add-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;
        if (addSection) {
          const isOpening = addSection.style.display === 'none';
          addSection.style.display = isOpening ? 'block' : 'none';

          // Set default currency to local currency when opening the form
          if (isOpening) {
            const currencySelect = addSection.querySelector('.new-cost-currency') as HTMLSelectElement;
            if (currencySelect) {
              // Find the first destination in this country to get its currency
              const destinations = (this.tripData.locations || []).filter(loc => loc.country === country);
              if (destinations.length > 0) {
                const localCurrency = getCurrencyForDestination(destinations[0].id, this.tripData.locations || []);
                currencySelect.value = localCurrency;

                // Trigger change event to update USD field disabled state
                currencySelect.dispatchEvent(new Event('change'));
              }
            }
          }
        }
      });
    });

    // Cancel new cost button
    this.container.querySelectorAll('.cancel-new-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;
        if (addSection) {
          addSection.style.display = 'none';
          // Reset form
          addSection.querySelectorAll('.new-cost-field').forEach(field => {
            const input = field as HTMLInputElement | HTMLSelectElement;
            if (input.type === 'number') {
              input.value = '0';
            } else {
              input.value = '';
            }
          });
        }
      });
    });

    // Currency sync for new cost form
    this.container.querySelectorAll('.new-cost-currency').forEach(currencySelect => {
      currencySelect.addEventListener('change', () => {
        const form = currencySelect.closest('.add-cost-form');
        const amountInput = form?.querySelector('.new-cost-amount') as HTMLInputElement;
        const usdInput = form?.querySelector('.new-cost-usd') as HTMLInputElement;

        if ((currencySelect as HTMLSelectElement).value === 'USD') {
          if (usdInput) {
            usdInput.disabled = true;
            usdInput.value = amountInput?.value || '0';
          }
        } else {
          if (usdInput) {
            usdInput.disabled = false;
          }
        }
      });
    });

    // Amount sync when currency is USD for new cost form
    this.container.querySelectorAll('.new-cost-amount').forEach(amountInput => {
      amountInput.addEventListener('input', () => {
        const form = amountInput.closest('.add-cost-form');
        const currencySelect = form?.querySelector('.new-cost-currency') as HTMLSelectElement;
        const usdInput = form?.querySelector('.new-cost-usd') as HTMLInputElement;

        if (currencySelect?.value === 'USD' && usdInput) {
          usdInput.value = (amountInput as HTMLInputElement).value;
        }
      });
    });

    // Save new cost button
    this.container.querySelectorAll('.save-new-cost-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;

        if (!addSection) return;

        // Collect form data
        const newCost: any = { status: 'estimated' };
        addSection.querySelectorAll('.new-cost-field').forEach(field => {
          const input = field as HTMLInputElement | HTMLSelectElement;
          const fieldName = input.dataset.field!;

          if (input.type === 'number') {
            newCost[fieldName] = parseFloat(input.value) || 0;
          } else {
            newCost[fieldName] = input.value;
          }
        });

        // Validate required fields
        if (!newCost.destination_id || !newCost.category) {
          alert('Please select a destination and category');
          return;
        }

        // Generate ID for new cost
        newCost.id = `${newCost.destination_id}_${newCost.category}_${Date.now()}`;

        // If currency is USD, ensure amount_usd equals amount
        if (newCost.currency === 'USD') {
          newCost.amount_usd = newCost.amount;
        }

        // Add to edited costs
        this.editedCosts.set(newCost.id, newCost);

        // Add to tripData temporarily for display
        if (!this.tripData.costs) {
          this.tripData.costs = [];
        }
        this.tripData.costs.push(newCost);

        // Hide form and re-render
        addSection.style.display = 'none';
        this.render();
      });
    });

    // Delete cost button
    this.container.querySelectorAll('.delete-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to delete this cost?')) return;

        const costId = (btn as HTMLElement).dataset.costId!;

        // Mark for deletion by setting a special flag
        const costIndex = (this.tripData.costs || []).findIndex(c =>
          (c.id || `${c.destination_id}_${c.category}_${Date.now()}`) === costId
        );

        if (costIndex !== -1) {
          const deletedCost = { ...this.tripData.costs![costIndex], _deleted: true };
          this.editedCosts.set(costId, deletedCost);
          this.tripData.costs!.splice(costIndex, 1);
          this.render();
        }
      });
    });

    // Refresh country rates button
    this.container.querySelectorAll('.refresh-country-rates-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const currencies = this.getCurrenciesForCountry(country);

        if (currencies.length === 0) return;

        // Show loading state
        const originalText = btn.textContent;
        btn.textContent = '⏳ Refreshing...';
        (btn as HTMLButtonElement).disabled = true;

        try {
          await this.refreshExchangeRates(currencies);

          // Update the rate display text
          const ratesDateEl = btn.closest('.costs-table-actions')?.querySelector('.rates-fetch-date');
          if (ratesDateEl) {
            ratesDateEl.textContent = `Rates: ${this.ratesFetchDate}`;
          }

          // Highlight all exchange rate displays for this country
          const countrySection = this.container.querySelector(`.item-costs-section[data-country="${country}"]`);
          if (countrySection) {
            countrySection.querySelectorAll('.exchange-rate-info').forEach(rateInfo => {
              const el = rateInfo as HTMLElement;
              el.style.transition = 'background-color 0.3s ease';
              el.style.backgroundColor = '#d4edda';
              el.style.padding = '4px 6px';
              el.style.borderRadius = '3px';

              // Remove highlight after 2 seconds
              setTimeout(() => {
                el.style.backgroundColor = '';
                el.style.padding = '';
                el.style.borderRadius = '';
              }, 2000);
            });
          }

          // Update exchange rate displays without full re-render
          this.updateExchangeRateDisplays(country);

          // Show success message in button briefly
          btn.textContent = '✓ Refreshed';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 1500);
        } catch (error) {
          btn.textContent = '✗ Failed';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
          console.error('Failed to refresh rates:', error);
        } finally {
          (btn as HTMLButtonElement).disabled = false;
        }
      });
    });

    // Refresh all rates button
    const refreshAllBtn = this.container.querySelector('#refresh-all-rates-btn');
    if (refreshAllBtn) {
      refreshAllBtn.addEventListener('click', async () => {
        const allCurrencies = this.getAllCurrencies();

        if (allCurrencies.length === 0) return;

        // Show loading state
        const originalText = refreshAllBtn.textContent;
        refreshAllBtn.textContent = '⏳ Refreshing...';
        (refreshAllBtn as HTMLButtonElement).disabled = true;

        try {
          await this.refreshExchangeRates();

          // Highlight all exchange rate displays
          this.container.querySelectorAll('.exchange-rate-info').forEach(rateInfo => {
            const el = rateInfo as HTMLElement;
            el.style.transition = 'background-color 0.3s ease';
            el.style.backgroundColor = '#d4edda';
            el.style.padding = '4px 6px';
            el.style.borderRadius = '3px';

            // Remove highlight after 2 seconds
            setTimeout(() => {
              el.style.backgroundColor = '';
              el.style.padding = '';
              el.style.borderRadius = '';
            }, 2000);
          });

          // Update all exchange rate displays without full re-render
          this.updateExchangeRateDisplays();

          // Show success message in button briefly
          refreshAllBtn.textContent = '✓ Refreshed';
          setTimeout(() => {
            refreshAllBtn.textContent = originalText;
          }, 1500);
        } catch (error) {
          refreshAllBtn.textContent = '✗ Failed';
          setTimeout(() => {
            refreshAllBtn.textContent = originalText;
          }, 2000);
          console.error('Failed to refresh rates:', error);
        } finally {
          (refreshAllBtn as HTMLButtonElement).disabled = false;
        }
      });
    }

    // Generate costs button for countries without costs
    this.container.querySelectorAll('.generate-costs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const destinationIds = (btn as HTMLElement).dataset.destinations?.split(',') || [];

        const destinations = destinationIds
          .map(id => (this.tripData.locations || []).find(loc => String(loc.id) === id))
          .filter(d => d);

        const destNames = destinations.map(d => d.name || d.city).join(', ');

        // Show progress UI
        const originalBtn = btn as HTMLButtonElement;
        const originalText = originalBtn.innerHTML;
        originalBtn.disabled = true;
        originalBtn.innerHTML = '⏳ Generating costs...';

        // Find and open the costs section to show progress
        const costsSection = this.container.querySelector(
          `.item-costs-section[data-country="${country}"]`
        ) as HTMLElement;

        // Open the costs section immediately to show progress
        if (costsSection) {
          costsSection.style.display = 'block';

          // Show progress message
          const progressDiv = document.createElement('div');
          progressDiv.className = 'cost-generation-progress';
          progressDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #f0f8ff; border-radius: 6px; margin: 15px 0;">
              <div style="font-size: 16px; font-weight: 600; color: #1a73e8; margin-bottom: 8px;">
                🤖 AI is generating cost estimates...
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                Researching ${destNames}
              </div>
              <div style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2, #667eea); background-size: 200% 100%; animation: shimmer 1.5s infinite;"></div>
              </div>
            </div>
            <style>
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            </style>
          `;
          costsSection.insertBefore(progressDiv, costsSection.firstChild);
        }

        try {
          // Generate costs using AI
          const generatedCosts = await this.generateCostsForCountry(country, destinationIds);

          if (generatedCosts.length === 0) {
            throw new Error('No costs were generated');
          }

          // Add generated costs to tripData
          if (!this.tripData.costs) {
            this.tripData.costs = [];
          }
          this.tripData.costs.push(...generatedCosts);

          // Save costs via callback
          if (this.onCostsUpdate) {
            await this.onCostsUpdate(generatedCosts);
          }

          // Show success message
          originalBtn.innerHTML = `✓ Generated ${generatedCosts.length} costs`;
          originalBtn.style.background = '#28a745';

          // Remove progress UI and refresh display
          if (costsSection) {
            const progressDiv = costsSection.querySelector('.cost-generation-progress');
            if (progressDiv) {
              progressDiv.remove();
            }
          }

          // Refresh the entire budget manager to show new costs
          this.render();

          // Automatically open the costs section for this country
          setTimeout(() => {
            const updatedCostsSection = this.container.querySelector(
              `.item-costs-section[data-country="${country}"]`
            ) as HTMLElement;
            if (updatedCostsSection) {
              updatedCostsSection.style.display = 'block';
            }

            // Update the toggle button text
            const toggleBtn = this.container.querySelector(
              `.costs-toggle-btn[data-country="${country}"]`
            ) as HTMLElement;
            if (toggleBtn) {
              const countryCurrentCosts = (this.tripData.costs || []).filter(c => {
                const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                return location?.country === country;
              });
              toggleBtn.innerHTML = `💰 ▼ Hide Costs (${countryCurrentCosts.length})`;
            }

            // Auto-resize textareas in the opened section
            this.setupAutoResizeTextareas();
          }, 100);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);

        } catch (error) {
          console.error('Failed to generate costs:', error);

          // Remove progress UI
          if (costsSection) {
            const progressDiv = costsSection.querySelector('.cost-generation-progress');
            if (progressDiv) {
              progressDiv.remove();
            }
          }

          // Show error
          originalBtn.innerHTML = '✗ Generation failed';
          originalBtn.style.background = '#dc3545';

          alert(`Failed to generate costs: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);
        }
      });
    });
  }

  private setupAutoResizeTextareas() {
    // Function to auto-resize a textarea based on its content
    const autoResize = (textarea: HTMLTextAreaElement) => {
      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    // Setup auto-resize for all textareas with the auto-resize class
    this.container.querySelectorAll('textarea.auto-resize').forEach(textarea => {
      const el = textarea as HTMLTextAreaElement;

      // Initial resize - use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        autoResize(el);
      });

      // Resize on input
      el.addEventListener('input', () => autoResize(el));

      // Resize on focus (in case content was changed programmatically)
      el.addEventListener('focus', () => autoResize(el));
    });
  }

  render() {
    const html = this.renderBudgetStatus();
    this.container.innerHTML = html;
    this.container.style.display = 'block';
    this.attachEventListeners();
  }
}

// CSS styles for the budget manager
export const budgetManagerStyles = `
<style>
.budget-manager {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin: 20px 0;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.budget-header h3 {
  margin: 0;
  font-size: 20px;
}

.budget-subtitle {
  color: #666;
  margin: 5px 0 0 0;
}

/* Compact header styles */
.budget-header-compact {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-row h3 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-primary-sm {
  padding: 6px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary-sm:hover {
  background: #0056b3;
}

.btn-secondary-sm {
  padding: 6px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary-sm:hover {
  background: #5a6268;
}

.btn-secondary-sm:disabled,
.btn-primary-sm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rates-fetch-date {
  font-size: 11px;
  color: #666;
  font-style: italic;
  margin-left: auto;
  white-space: nowrap;
}

.auto-save-indicator {
  font-size: 12px;
  font-weight: 600;
  margin-left: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.auto-save-indicator.saving {
  color: #0056b3;
  background: #cfe2ff;
}

.auto-save-indicator.saved {
  color: #155724;
  background: #d4edda;
}

.auto-save-indicator.error {
  color: #721c24;
  background: #f8d7da;
}

.budget-overview-compact {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.budget-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.budget-field label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.budget-field input {
  width: 90px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.budget-field span {
  font-size: 12px;
  color: #666;
}

.budget-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.stat-value.positive {
  color: #28a745;
}

.stat-value.negative {
  color: #dc3545;
}

.stat-pct {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-left: 4px;
}

.budget-progress-compact {
  margin-top: 8px;
}

.budget-progress-compact .progress-bar {
  height: 6px;
  border-radius: 3px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px 10px;
}

.btn-icon:hover {
  background: #f0f0f0;
  border-radius: 4px;
}

.budget-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.budget-total, .budget-spent, .budget-remaining {
  padding: 15px;
  border-radius: 6px;
  background: #f8f9fa;
}

.budget-spent.over-budget {
  background: #fee;
}

.budget-spent.warning {
  background: #fff3cd;
}

.budget-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.budget-amount {
  font-size: 24px;
  font-weight: bold;
}

.budget-amount.negative {
  color: #dc3545;
}

.budget-progress {
  margin: 20px 0;
}

.progress-bar {
  height: 30px;
  background: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.progress-bar.caution .progress-fill {
  background: #ffc107;
}

.progress-bar.warning .progress-fill {
  background: #fd7e14;
}

.progress-bar.over-budget .progress-fill {
  background: #dc3545;
}

.progress-label {
  text-align: center;
  margin-top: 5px;
  font-weight: bold;
}

.budget-alerts {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.budget-alerts h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.budget-alert {
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-info {
  background: #d1ecf1;
  border-left: 4px solid #0c5460;
}

.alert-warning {
  background: #fff3cd;
  border-left: 4px solid #856404;
}

.alert-exceeded {
  background: #f8d7da;
  border-left: 4px solid #721c24;
}

.budget-breakdown {
  margin: 20px 0;
}

.budget-breakdown h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.budget-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.budget-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.item-name {
  font-weight: 500;
  text-transform: capitalize;
}

.item-amounts {
  font-size: 14px;
  color: #666;
}

.item-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-progress-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.mini-progress-bar.warning .mini-progress-fill {
  background: #fd7e14;
}

.mini-progress-bar.over-budget .mini-progress-fill {
  background: #dc3545;
}

.item-percentage {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: right;
}

.budget-actions {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.budget-help {
  margin-top: 20px;
  padding: 15px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
}

.budget-help p {
  margin: 0;
  font-size: 14px;
}

.current-spending {
  margin: 20px 0;
}

.spending-summary {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.spending-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.spending-amount {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
}

/* Integrated budget interface styles */
.budget-manager.integrated {
  max-width: 100%;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.budget-edit-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
}

.budget-edit-section h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h4 {
  margin: 0;
}

.mode-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-indicator {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.budget-overview-edit {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.form-group-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.form-group-inline label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.budget-status-display {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.status-value {
  font-size: 18px;
  font-weight: bold;
}

.status-value.positive {
  color: #28a745;
}

.status-value.negative {
  color: #dc3545;
}

.status-value.over-budget,
.status-value.warning {
  color: #dc3545;
}

.allocation-status {
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.allocation-info {
  font-size: 14px;
}

.allocation-remainder {
  font-weight: 600;
  font-size: 14px;
}

.budget-summary-box {
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.summary-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.summary-label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.summary-value {
  font-weight: 700;
  color: #333;
  font-size: 16px;
  transition: color 0.2s;
}

.summary-percentage {
  font-weight: 600;
  font-size: 14px;
  margin-left: 10px;
  transition: color 0.2s;
}

.budget-items-edit {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.budget-item-edit {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.item-label {
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.item-header-row {
  margin-bottom: 10px;
}

.item-label-with-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-label-text {
  font-weight: 600;
  color: #333;
}

.inline-note {
  flex: 1;
  color: #666;
  font-size: 13px;
  font-style: italic;
  padding: 4px 8px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
  min-width: 200px;
}

.days-label {
  font-weight: normal;
  color: #666;
  font-size: 13px;
}

.item-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 300px;
}

.item-status .mini-progress-bar {
  flex: 1;
  min-width: 100px;
}

.budget-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 180px;
  gap: 8px;
}

.input-with-unit input {
  width: 120px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-with-unit input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.input-unit {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  min-width: 35px;
  text-align: left;
}

.calc-arrow {
  font-size: 16px;
  color: #999;
  flex-shrink: 0;
}

.calculated-display {
  min-width: 80px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #007bff;
}

.calc-value {
  white-space: nowrap;
}

.current-spend {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

/* Toggle Switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-switch input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  transition: background-color 0.3s;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

/* Allocation status colors */
#allocation-status,
#country-allocation-status {
  border-left: 4px solid #007bff;
}

/* Country mode selector buttons */
.country-mode-selector {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 6px;
}

.mode-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #666;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #e0e0e0;
}

.mode-btn.active {
  background: #007bff;
  color: white;
}

/* Notes sections */
.group-note-section {
  margin: 15px 0;
  padding: 12px;
  background: #fffbf0;
  border-radius: 6px;
  border: 1px solid #ffe4a3;
}

.note-label {
  display: block;
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 6px;
}

.group-note-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.group-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.note-toggle-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  margin-left: 8px;
}

.note-toggle-btn:hover {
  opacity: 1;
}

.item-note-section {
  margin-top: 10px;
  padding: 10px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
}

.item-note-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
}

.item-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

/* Category breakdown visualization */
.est-cost-with-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-breakdown-bar {
  display: flex;
  height: 8px;
  gap: 1px;
  border-radius: 4px;
  overflow: hidden;
}

.cat-breakdown-item {
  flex: 1;
  min-width: 3px;
  transition: transform 0.2s;
}

.cat-breakdown-item:hover {
  transform: scaleY(1.5);
  cursor: help;
}

/* Costs toggle button */
.costs-toggle-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  margin-left: 8px;
  font-weight: 500;
}

.costs-toggle-btn:hover {
  background: #0056b3;
}

/* Costs section */
.item-costs-section {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.country-costs-table {
  background: white;
  border-radius: 6px;
  padding: 12px;
}

.destination-costs-section {
  margin-bottom: 20px;
}

.destination-costs-section:last-child {
  margin-bottom: 0;
}

.destination-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exchange-rates-header {
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #333;
  border: 1px solid #e0e0e0;
}

.currency-rate-item {
  font-family: monospace;
  color: #555;
}

.rates-date-small {
  color: #999;
  font-size: 11px;
  font-style: italic;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}

.regenerate-destination-costs-btn,
.regenerate-country-costs-btn {
  white-space: nowrap;
}

.costs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 12px;
}

.costs-table thead {
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
}

.costs-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.costs-table th.text-right {
  text-align: right;
}

.costs-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.costs-table tbody tr:hover {
  background: #f8f9fa;
}

.costs-table td {
  padding: 10px 12px;
  color: #333;
}

.costs-table td.text-right {
  text-align: right;
}

.costs-table td.amount-cell {
  font-weight: 600;
  color: #007bff;
  white-space: nowrap;
}

.costs-table td.notes-cell {
  color: #666;
  font-size: 12px;
  word-wrap: break-word;
  max-width: 400px;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.status-estimated {
  background: #fff3cd;
  color: #856404;
}

.status-researched {
  background: #d1ecf1;
  color: #0c5460;
}

.status-booked {
  background: #d4edda;
  color: #155724;
}

.status-paid {
  background: #c3e6cb;
  color: #155724;
}

.costs-table tfoot .total-row {
  background: #f8f9fa;
  border-top: 2px solid #dee2e6;
  font-weight: 600;
}

.costs-table tfoot .total-row td {
  padding: 12px;
}

.country-total-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: #e7f3ff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #007bff;
  margin-top: 12px;
  border: 1px solid #b8daff;
}

.no-costs-container {
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.no-costs-message {
  padding: 24px;
  text-align: center;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}

.generate-costs-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.generate-costs-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.generate-costs-btn:active {
  transform: translateY(0);
}

.inline-generate-btn {
  padding: 6px 12px;
  font-size: 13px;
  margin-left: 8px;
}

/* Editable costs table styles */
.costs-table-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.unsaved-indicator {
  color: #dc3545;
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
}

.editable-costs-table {
  table-layout: fixed;
}

.cost-field-input,
.cost-field-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
  font-family: inherit;
}

.cost-field-input:focus,
.cost-field-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.cost-field-input:disabled {
  background: #f8f9fa;
  color: #999;
}

textarea.cost-field-input {
  resize: none;
  overflow: hidden;
  min-height: 34px;
  line-height: 1.4;
}

textarea.auto-resize {
  resize: none;
  overflow: hidden;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

/* Add cost form */
.add-cost-section {
  margin-top: 15px;
}

.add-cost-form {
  background: white;
  padding: 20px;
  border-radius: 6px;
  border: 2px solid #28a745;
}

.add-cost-form h5 {
  margin: 0 0 15px 0;
  color: #28a745;
  font-size: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-start;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.new-cost-field {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.new-cost-field:focus {
  outline: none;
  border-color: #28a745;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.new-cost-field:disabled {
  background: #f8f9fa;
  color: #999;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

/* Currency input with symbol */
.currency-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 8px;
  font-weight: 600;
  color: #666;
  pointer-events: none;
  z-index: 1;
  font-size: 14px;
}

.currency-input-wrapper .cost-field-input {
  padding-left: 36px;
  text-align: right;
}

.currency-display-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.currency-code-display {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  padding: 4px 0;
}

.exchange-rate-info {
  font-size: 10px;
  color: #666;
  font-style: italic;
  white-space: nowrap;
  line-height: 1.3;
}

.rate-date {
  font-size: 9px;
  color: #999;
}

/* Prompt Edit Modal */
.prompt-edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.prompt-edit-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.prompt-edit-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.prompt-edit-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-modal-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-modal-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.prompt-edit-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.prompt-edit-textarea {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.prompt-edit-footer {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
`;
