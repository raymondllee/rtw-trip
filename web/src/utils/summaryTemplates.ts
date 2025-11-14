/**
 * HTML templates for itinerary summary generation
 */

import { SummaryData, SummaryOptions, getTopCountries, calculateCostPercentages, generateRouteVisualization, extractHighlights, groupLocationsByMonth } from './summaryGenerator';
import { CountryStay } from './countryAggregator';
import { formatDateRange, formatDuration, formatCurrency, formatPercentage, formatList, getContinentEmoji, getCategoryEmoji, getCategoryColor, formatNumber } from './summaryFormatters';

/**
 * Generate complete summary HTML
 */
export function generateSummaryHTML(summaryData: SummaryData, options: SummaryOptions): string {
  const sections: string[] = [];

  sections.push(generateHeader(summaryData, options));

  if (options.includeExecutive) {
    sections.push(generateExecutiveSummary(summaryData, options));
  }

  if (options.includeDetailed) {
    sections.push(generateDetailedItinerary(summaryData, options));
  }

  if (options.includeFinancial) {
    sections.push(generateFinancialSummary(summaryData, options));
  }

  if (options.includeTimeline) {
    sections.push(generateTimelineView(summaryData, options));
  }

  if (options.includeDestinations) {
    sections.push(generateDestinationDetails(summaryData, options));
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${summaryData.tripName} - Itinerary Summary</title>
      <link rel="stylesheet" href="summary-print.css">
    </head>
    <body>
      ${sections.join('\n')}
    </body>
    </html>
  `;
}

/**
 * Generate header section
 */
function generateHeader(summaryData: SummaryData, options: SummaryOptions): string {
  // Format version/date info
  let versionInfo = '';
  if (summaryData.scenarioVersion) {
    versionInfo = `v${summaryData.scenarioVersion}`;
  }
  if (summaryData.scenarioUpdatedAt) {
    const date = new Date(summaryData.scenarioUpdatedAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    versionInfo = versionInfo ? `${versionInfo} • ${dateStr}` : dateStr;
  }

  return `
    <header class="summary-header">
      <div class="header-row">
        <div class="title-group">
          <h1 class="trip-title">${summaryData.tripName}</h1>
          ${versionInfo ? `<div class="version-info">${versionInfo}</div>` : ''}
        </div>
        <div class="header-stats">
          <span class="header-stat">${summaryData.stats.totalCountries} countries</span>
          <span class="header-stat">${summaryData.stats.totalLocations} destinations</span>
          <span class="header-stat">${formatDuration(summaryData.totalDays, false)}</span>
          ${options.showCosts ? `<span class="header-stat cost-stat">${formatCurrency(summaryData.totalCost)}</span>` : ''}
        </div>
      </div>
    </header>
  `;
}

/**
 * Generate Executive Summary section
 */
function generateExecutiveSummary(summaryData: SummaryData, options: SummaryOptions): string {
  // Condensed Journey Table combining route and regional data
  const journeyTableHtml = generateCondensedJourneyTable(summaryData, options);

  return `
    <section class="executive-summary" data-section="executive">
      ${journeyTableHtml}
    </section>
  `;
}

/**
 * Generate condensed journey table combining route and regional info
 */
function generateCondensedJourneyTable(summaryData: SummaryData, options: SummaryOptions): string {
  // Get countries in chronological order with their data
  const route = generateRouteVisualization(summaryData);
  const countryStaysMap = new Map(summaryData.countryStays.map(c => [c.country, c]));

  // Helper to format dates compactly
  const formatCompactDates = (start?: string, end?: string) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  // Helper to format multiple visits
  const formatMultipleVisits = (countryData: CountryStay) => {
    if (!countryData.visits || countryData.visits.length === 0) {
      return formatCompactDates(countryData.startDate, countryData.endDate);
    }

    if (countryData.visits.length === 1) {
      return formatCompactDates(countryData.visits[0].startDate, countryData.visits[0].endDate);
    }

    // Multiple visits - show each separately
    return countryData.visits
      .map(visit => formatCompactDates(visit.startDate, visit.endDate))
      .join('; ');
  };

  return `
    <div class="condensed-journey">
      <table class="journey-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="min-width: 140px;">Country</th>
            <th style="min-width: 110px;">Region</th>
            <th style="width: 50px; text-align: center;">Days</th>
            <th style="width: 45px; text-align: center;">Dest</th>
            <th style="min-width: 130px; white-space: nowrap;">Dates</th>
            ${options.showCosts ? '<th style="width: 85px; text-align: right;">Budget</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${route.map((country, index) => {
            const countryData = countryStaysMap.get(country);
            if (!countryData) return '';

            const multipleVisits = countryData.visits && countryData.visits.length > 1;

            return `
              <tr>
                <td style="text-align: center; font-weight: 600; color: #3b82f6;">${index + 1}</td>
                <td style="font-weight: 500;">${country}${multipleVisits ? ' <span style="color: #f59e0b; font-size: 11px;">(' + countryData.visits.length + ' visits)</span>' : ''}</td>
                <td style="color: #6b7280; font-size: 12px;">${countryData.region || countryData.continent || ''}</td>
                <td style="text-align: center;">${countryData.totalDays}</td>
                <td style="text-align: center; color: #6b7280;">${countryData.destinations.length}</td>
                <td style="font-size: 12px; color: #6b7280; white-space: nowrap;">${formatMultipleVisits(countryData)}</td>
                ${options.showCosts ? `<td style="text-align: right; font-weight: 500; font-size: 13px;">${formatCurrency(countryData.totalCosts)}</td>` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: 600; background: #f3f4f6;">
            <td colspan="3" style="text-align: right; padding-right: 0.5rem; font-size: 13px;">TOTAL</td>
            <td style="text-align: center;">${summaryData.stats.totalDays}</td>
            <td style="text-align: center;">${summaryData.stats.totalLocations}</td>
            <td></td>
            ${options.showCosts ? `<td style="text-align: right;">${formatCurrency(summaryData.stats.totalCosts)}</td>` : ''}
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

/**
 * Generate regional breakdown
 */
function generateRegionalBreakdown(summaryData: SummaryData, options: SummaryOptions): string {
  const regions = summaryData.regions;
  const regionEntries = Array.from(regions.entries());

  if (regionEntries.length === 0) {
    return '';
  }

  return `
    <div class="regional-breakdown">
      <h3>By Region</h3>
      ${regionEntries.map(([regionName, regionData]) => {
        const emoji = getContinentEmoji(regionData.continent);
        return `
          <div class="region-card">
            <div class="region-header">
              <span class="region-emoji">${emoji}</span>
              <span class="region-name">${regionName}</span>
            </div>
            <div class="region-stats">
              <span>${formatDuration(regionData.totalDays)}</span>
              <span>${regionData.countries.length} ${regionData.countries.length === 1 ? 'country' : 'countries'}</span>
              ${options.showCosts ? `<span>${formatCurrency(regionData.totalCosts)}</span>` : ''}
            </div>
            <div class="region-countries">${formatList(regionData.countries, 5)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Generate Detailed Itinerary section
 */
function generateDetailedItinerary(summaryData: SummaryData, options: SummaryOptions): string {
  const continents = summaryData.continents;
  const continentEntries = Array.from(continents.entries()).sort((a, b) => {
    // Sort by first country's start date
    const aDate = a[1][0]?.startDate || '';
    const bDate = b[1][0]?.startDate || '';
    return aDate.localeCompare(bDate);
  });

  const continentsHtml = continentEntries.map(([continentName, countries]) => {
    const emoji = getContinentEmoji(continentName);
    const totalDays = countries.reduce((sum, c) => sum + c.totalDays, 0);
    const totalCosts = countries.reduce((sum, c) => sum + c.totalCosts, 0);

    return `
      <div class="continent-section page-break-before">
        <h3 class="continent-header">
          <span class="continent-emoji">${emoji}</span>
          ${continentName || 'Other'}
          <span class="continent-meta">
            ${formatDuration(totalDays)}
            ${options.showCosts ? ` • ${formatCurrency(totalCosts)}` : ''}
          </span>
        </h3>
        ${countries.map(country => generateCountryDetail(country, options)).join('')}
      </div>
    `;
  }).join('');

  return `
    <section class="detailed-itinerary page-break-before" data-section="detailed">
      <h2 class="section-title">Detailed Itinerary</h2>
      ${continentsHtml}
    </section>
  `;
}

/**
 * Generate country detail block
 */
function generateCountryDetail(country: CountryStay, options: SummaryOptions): string {
  const multipleVisits = country.visits && country.visits.length > 1;

  // Generate date range display
  let dateRangeHtml = '';
  if (multipleVisits) {
    // Show separate visits
    dateRangeHtml = country.visits.map((visit, idx) => {
      const visitNum = idx + 1;
      return `<div><strong>Visit ${visitNum}:</strong> ${formatDateRange(visit.startDate, visit.endDate)} (${formatDuration(visit.days)})</div>`;
    }).join('');
  } else {
    dateRangeHtml = formatDateRange(country.startDate, country.endDate);
  }

  // Sort destinations by arrival date
  const sortedDestinations = [...country.destinations].sort((a, b) => {
    const dateA = a.arrival_date || '';
    const dateB = b.arrival_date || '';
    return dateA.localeCompare(dateB);
  });

  const destinationsHtml = sortedDestinations.map(dest => `
    <div class="destination">
      <div class="destination-header">
        <h5 class="destination-name">${dest.name || dest.city || 'Unknown'}</h5>
        <span class="destination-dates">${formatDateRange(dest.arrival_date, dest.departure_date)}</span>
      </div>
      <div class="destination-details">
        ${dest.duration_days ? `<span class="destination-duration">${formatDuration(dest.duration_days)}</span>` : ''}
        ${dest.activity_type ? `<span class="destination-activity">${dest.activity_type}</span>` : ''}
        ${dest.airport_code ? `<span class="destination-airport">${dest.airport_code}</span>` : ''}
      </div>
      ${dest.highlights && dest.highlights.length > 0 ? `
        <ul class="destination-highlights">
          ${dest.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      ` : ''}
      ${dest.transport_from_previous ? `
        <div class="destination-transport">
          <span class="transport-label">Transport:</span> ${dest.transport_from_previous}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Cost breakdown
  const costBreakdownHtml = options.showCosts && Object.keys(country.costsByCategory).length > 0 ? `
    <div class="country-costs">
      <h5>Cost Breakdown</h5>
      <table class="cost-table">
        ${Object.entries(country.costsByCategory).map(([category, amount]) => `
          <tr>
            <td>${getCategoryEmoji(category)} ${category}</td>
            <td class="cost-amount">${formatCurrency(amount)}</td>
          </tr>
        `).join('')}
        <tr class="cost-total">
          <td><strong>Total</strong></td>
          <td class="cost-amount"><strong>${formatCurrency(country.totalCosts)}</strong></td>
        </tr>
      </table>
    </div>
  ` : '';

  return `
    <div class="country-block">
      <h4 class="country-name">
        ${country.country}
        <span class="country-meta">
          ${formatDuration(country.totalDays)} • ${country.destinations.length} ${country.destinations.length === 1 ? 'destination' : 'destinations'}
          ${options.showCosts ? ` • ${formatCurrency(country.totalCosts)}` : ''}
        </span>
      </h4>
      <div class="country-dates">${dateRangeHtml}</div>
      ${destinationsHtml}
      ${costBreakdownHtml}
    </div>
  `;
}

/**
 * Generate Financial Summary section
 */
function generateFinancialSummary(summaryData: SummaryData, options: SummaryOptions): string {
  if (!options.showCosts) {
    return '';
  }

  const { stats, countryStays } = summaryData;

  // Cost by category
  const costsByCategory = stats.costsByCategory;
  const categoryPercentages = calculateCostPercentages(costsByCategory);
  const sortedCategories = Object.entries(costsByCategory)
    .sort((a, b) => b[1] - a[1]);

  const categoryBreakdownHtml = `
    <div class="category-breakdown">
      <h3>Costs by Category</h3>
      <table class="financial-table">
        <thead>
          <tr>
            <th>Category</th>
            <th class="numeric">Amount</th>
            <th class="numeric">Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${sortedCategories.map(([category, amount]) => `
            <tr>
              <td>${getCategoryEmoji(category)} ${category}</td>
              <td class="numeric">${formatCurrency(amount)}</td>
              <td class="numeric">${formatPercentage(amount, stats.totalCosts)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td class="numeric"><strong>${formatCurrency(stats.totalCosts)}</strong></td>
            <td class="numeric"><strong>100%</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // Cost by country
  const sortedCountries = [...countryStays]
    .filter(c => c.totalCosts > 0)
    .sort((a, b) => b.totalCosts - a.totalCosts);

  const countryBreakdownHtml = `
    <div class="country-costs-breakdown">
      <h3>Costs by Country</h3>
      <table class="financial-table">
        <thead>
          <tr>
            <th>Country</th>
            <th class="numeric">Days</th>
            <th class="numeric">Total Cost</th>
            <th class="numeric">Per Day</th>
            <th class="numeric">% of Budget</th>
          </tr>
        </thead>
        <tbody>
          ${sortedCountries.map(country => {
            const perDay = country.totalDays > 0 ? country.totalCosts / country.totalDays : 0;
            return `
              <tr>
                <td>${country.country}</td>
                <td class="numeric">${country.totalDays}</td>
                <td class="numeric">${formatCurrency(country.totalCosts)}</td>
                <td class="numeric">${formatCurrency(perDay)}</td>
                <td class="numeric">${formatPercentage(country.totalCosts, stats.totalCosts)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td class="numeric"><strong>${stats.totalDays}</strong></td>
            <td class="numeric"><strong>${formatCurrency(stats.totalCosts)}</strong></td>
            <td class="numeric"><strong>${formatCurrency(stats.averageCostPerDay)}</strong></td>
            <td class="numeric"><strong>100%</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // Key financial insights
  const insightsHtml = `
    <div class="financial-insights">
      <h3>Financial Insights</h3>
      <div class="insights-grid">
        <div class="insight-card">
          <div class="insight-label">Average Cost per Day</div>
          <div class="insight-value">${formatCurrency(stats.averageCostPerDay)}</div>
        </div>
        ${stats.mostExpensive ? `
          <div class="insight-card">
            <div class="insight-label">Most Expensive</div>
            <div class="insight-value">${stats.mostExpensive.country}</div>
            <div class="insight-detail">${formatCurrency(stats.mostExpensive.cost)}</div>
          </div>
        ` : ''}
        ${stats.leastExpensive ? `
          <div class="insight-card">
            <div class="insight-label">Most Affordable</div>
            <div class="insight-value">${stats.leastExpensive.country}</div>
            <div class="insight-detail">${formatCurrency(stats.leastExpensive.cost)}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return `
    <section class="financial-summary page-break-before" data-section="financial">
      <h2 class="section-title">Financial Summary</h2>
      ${insightsHtml}
      ${categoryBreakdownHtml}
      ${countryBreakdownHtml}
    </section>
  `;
}

/**
 * Generate Timeline View section
 */
function generateTimelineView(summaryData: SummaryData, options: SummaryOptions): string {
  const monthGroups = groupLocationsByMonth(summaryData.locations);
  const monthEntries = Array.from(monthGroups.entries());

  const timelineHtml = monthEntries.map(([month, locations]) => {
    const totalDays = locations.reduce((sum, loc) => sum + (loc.duration_days || 0), 0);
    const countries = Array.from(new Set(locations.map(loc => loc.country).filter(c => c)));

    return `
      <div class="timeline-month">
        <h3 class="month-header">
          ${month}
          <span class="month-meta">${formatDuration(totalDays)} • ${countries.length} ${countries.length === 1 ? 'country' : 'countries'}</span>
        </h3>
        <div class="timeline-locations">
          ${locations.map(loc => `
            <div class="timeline-location">
              <div class="timeline-date">${formatDateRange(loc.arrival_date, loc.departure_date)}</div>
              <div class="timeline-name">${loc.name || loc.city || 'Unknown'}</div>
              <div class="timeline-country">${loc.country || ''}</div>
              ${loc.duration_days ? `<div class="timeline-duration">${formatDuration(loc.duration_days)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Monthly overview table
  const monthlyOverview = `
    <div class="monthly-overview">
      <h3>Monthly Overview</h3>
      <table class="timeline-table">
        <thead>
          <tr>
            <th>Month</th>
            <th class="numeric">Days</th>
            <th>Countries</th>
            ${options.showCosts ? '<th class="numeric">Budget</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${Array.from(summaryData.stats.monthlyBreakdown.entries()).map(([month, data]) => {
            // Calculate costs for this month if needed
            const monthCosts = options.showCosts ? calculateMonthCosts(summaryData, month) : 0;

            return `
              <tr>
                <td>${month}</td>
                <td class="numeric">${data.days}</td>
                <td>${formatList(data.countries, 3)}</td>
                ${options.showCosts ? `<td class="numeric">${formatCurrency(monthCosts)}</td>` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  return `
    <section class="timeline-view page-break-before" data-section="timeline">
      <h2 class="section-title">Timeline</h2>
      ${monthlyOverview}
      ${timelineHtml}
    </section>
  `;
}

/**
 * Calculate costs for a specific month (helper function)
 */
function calculateMonthCosts(summaryData: SummaryData, month: string): number {
  // This is a simplified calculation - could be enhanced
  // For now, distribute costs proportionally by days
  const monthData = summaryData.stats.monthlyBreakdown.get(month);
  if (!monthData) return 0;

  const monthDays = monthData.days;
  const totalDays = summaryData.totalDays;
  const totalCosts = summaryData.totalCost;

  return totalDays > 0 ? (monthDays / totalDays) * totalCosts : 0;
}

/**
 * Generate destination-level details table
 */
function generateDestinationDetails(summaryData: SummaryData, options: SummaryOptions): string {
  const locations = summaryData.locations.filter(loc => loc.arrival_date && loc.departure_date);

  // Helper to format dates compactly
  const formatCompactDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  return `
    <section class="destination-details" data-section="destinations">
      <h2>Destination Details</h2>
      <table class="journey-table destination-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="min-width: 160px;">Destination</th>
            <th style="min-width: 120px;">Country</th>
            <th style="width: 50px; text-align: center;">Days</th>
            <th style="min-width: 80px;">Arrival</th>
            <th style="min-width: 80px;">Departure</th>
            ${options.showCosts ? '<th style="width: 85px; text-align: right;">Cost</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${locations.map((loc, index) => {
            const arrival = formatCompactDate(loc.arrival_date);
            const departure = formatCompactDate(loc.departure_date);
            const days = loc.duration_days || 0;
            const cost = loc.total_cost || 0;

            return `
              <tr>
                <td style="text-align: center; font-weight: 600; color: #3b82f6;">${index + 1}</td>
                <td style="font-weight: 500;">${loc.name || loc.city || 'Unknown'}</td>
                <td style="color: #6b7280; font-size: 12px;">${loc.country || ''}</td>
                <td style="text-align: center;">${days}</td>
                <td style="font-size: 12px; color: #6b7280;">${arrival}</td>
                <td style="font-size: 12px; color: #6b7280;">${departure}</td>
                ${options.showCosts ? `<td style="text-align: right; font-weight: 500; font-size: 13px;">${formatCurrency(cost)}</td>` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight: 600; background: #f3f4f6;">
            <td colspan="3" style="text-align: right; padding-right: 0.5rem; font-size: 13px;">TOTAL</td>
            <td style="text-align: center;">${summaryData.stats.totalDays}</td>
            <td colspan="2"></td>
            ${options.showCosts ? `<td style="text-align: right;">${formatCurrency(summaryData.totalCost)}</td>` : ''}
          </tr>
        </tfoot>
      </table>
    </section>
  `;
}
