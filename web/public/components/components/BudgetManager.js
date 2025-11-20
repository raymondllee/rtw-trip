"use strict";
/**
 * Budget Manager UI Component (Recommendation J)
 * Provides integrated budget tracking, editing, and management interface
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetManagerStyles = exports.BudgetManager = void 0;
var budgetTracker_1 = require("../utils/budgetTracker");
var currencyMapping_1 = require("../utils/currencyMapping");
var config_1 = require("../config");
var BudgetManager = /** @class */ (function () {
    function BudgetManager(container, tripData, budget, onBudgetUpdate, onCostsUpdate) {
        this.editedCosts = new Map();
        this.exchangeRates = {};
        this.ratesFetchDate = '';
        this.autoSaveTimer = null;
        this.savingCosts = new Set();
        this.container = container;
        this.tripData = tripData;
        this.budget = budget || null;
        this.onBudgetUpdate = onBudgetUpdate;
        this.onCostsUpdate = onCostsUpdate;
        // Fetch exchange rates on initialization
        this.fetchExchangeRates();
        this.render();
    }
    BudgetManager.prototype.scheduleAutoSave = function () {
        var _this = this;
        // Clear existing timer
        if (this.autoSaveTimer !== null) {
            window.clearTimeout(this.autoSaveTimer);
        }
        // Schedule save for 2 seconds after last edit
        this.autoSaveTimer = window.setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.saveAllCosts()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, 2000);
    };
    BudgetManager.prototype.saveAllCosts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var costsToSave, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.editedCosts.size === 0 || !this.onCostsUpdate)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        costsToSave = Array.from(this.editedCosts.values());
                        // Show saving indicator
                        this.showSavingIndicator(true);
                        return [4 /*yield*/, this.onCostsUpdate(costsToSave)];
                    case 2:
                        _a.sent();
                        // Clear edited costs after successful save
                        this.editedCosts.clear();
                        // Update totals without full re-render
                        this.updateCostTotals();
                        // Show success indicator briefly
                        this.showSavingIndicator(false, true);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Failed to auto-save costs:', error_1);
                        this.showSavingIndicator(false, false, 'Failed to save');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BudgetManager.prototype.showSavingIndicator = function (saving, success, message) {
        var indicators = this.container.querySelectorAll('.auto-save-indicator');
        indicators.forEach(function (indicator) {
            if (saving) {
                indicator.textContent = '💾 Saving...';
                indicator.className = 'auto-save-indicator saving';
            }
            else if (success) {
                indicator.textContent = '✓ Saved';
                indicator.className = 'auto-save-indicator saved';
                setTimeout(function () {
                    indicator.textContent = '';
                    indicator.className = 'auto-save-indicator';
                }, 2000);
            }
            else {
                indicator.textContent = message || '✗ Save failed';
                indicator.className = 'auto-save-indicator error';
            }
        });
    };
    BudgetManager.prototype.updateCostTotals = function () {
        var _this = this;
        // Update totals for each country without full re-render
        var countries = new Set();
        (this.tripData.locations || []).forEach(function (loc) {
            if (loc.country)
                countries.add(loc.country);
        });
        countries.forEach(function (country) {
            var countryCosts = (_this.tripData.costs || [])
                .filter(function (c) {
                var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
                return (location === null || location === void 0 ? void 0 : location.country) === country;
            });
            var total = countryCosts.reduce(function (sum, c) { return sum + (c.amount_usd || c.amount || 0); }, 0);
            var totalElement = _this.container.querySelector(".country-total-row[data-country=\"".concat(country, "\"] .country-total-amount"));
            if (totalElement) {
                totalElement.textContent = _this.formatCurrency(total);
            }
        });
    };
    BudgetManager.prototype.fetchExchangeRates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('https://api.exchangerate-api.com/v4/latest/USD')];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (data && data.rates) {
                            this.exchangeRates = data.rates;
                            this.ratesFetchDate = new Date(data.time_last_updated * 1000).toLocaleDateString();
                            console.log('✅ Exchange rates fetched:', this.ratesFetchDate);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Failed to fetch exchange rates:', error_2);
                        // Set default rates if API fails
                        this.exchangeRates = {
                            USD: 1,
                            EUR: 0.92,
                            GBP: 0.79,
                            JPY: 149.50,
                            AUD: 1.52,
                            CAD: 1.36,
                            CNY: 7.24,
                            INR: 83.12,
                            THB: 34.50,
                            VND: 24450,
                            FJD: 2.24,
                            SGD: 1.34,
                            NZD: 1.68
                        };
                        this.ratesFetchDate = 'Using default rates';
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BudgetManager.prototype.refreshExchangeRates = function (currencies) {
        return __awaiter(this, void 0, void 0, function () {
            var response, data_1, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('https://api.exchangerate-api.com/v4/latest/USD')];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data_1 = _a.sent();
                        if (data_1 && data_1.rates) {
                            // Update specific currencies if provided, otherwise update all
                            if (currencies && currencies.length > 0) {
                                currencies.forEach(function (currency) {
                                    if (data_1.rates[currency]) {
                                        _this.exchangeRates[currency] = data_1.rates[currency];
                                    }
                                });
                            }
                            else {
                                this.exchangeRates = data_1.rates;
                            }
                            this.ratesFetchDate = new Date(data_1.time_last_updated * 1000).toLocaleDateString();
                            console.log('✅ Exchange rates refreshed:', currencies ? currencies.join(', ') : 'all');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Failed to refresh exchange rates:', error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BudgetManager.prototype.generateCostsForCountry = function (country, destinationIds) {
        return __awaiter(this, void 0, void 0, function () {
            var destinations, enrichedDestinations, prompt, config, chatApiUrl, scenarioId, response, errorText, data, responseText, costs;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        destinations = destinationIds
                            .map(function (id) { return (_this.tripData.locations || []).find(function (loc) { return String(loc.id) === id; }); })
                            .filter(function (d) { return d; });
                        if (destinations.length === 0) {
                            throw new Error('No valid destinations found');
                        }
                        enrichedDestinations = destinations.map(function (dest) {
                            var localCurrency = (0, currencyMapping_1.getCurrencyForDestination)(dest.id, _this.tripData.locations || []);
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
                        prompt = this.generateCostPrompt(enrichedDestinations, country);
                        config = (0, config_1.getRuntimeConfig)();
                        chatApiUrl = config.endpoints.chat;
                        scenarioId = window.currentScenarioId || null;
                        return [4 /*yield*/, fetch(chatApiUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    message: prompt,
                                    context: {
                                        destinations: enrichedDestinations.map(function (d) { return ({
                                            id: d.id,
                                            name: d.name,
                                            country: d.country,
                                            duration_days: d.durationDays
                                        }); })
                                    },
                                    scenario_id: scenarioId,
                                    session_id: null // New session for cost generation
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        errorText = _a.sent();
                        throw new Error("API error: ".concat(response.status, " - ").concat(errorText));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        data = _a.sent();
                        responseText = data.response || data.text || '';
                        costs = this.parseAICostResponse(responseText, enrichedDestinations);
                        return [2 /*return*/, costs];
                }
            });
        });
    };
    BudgetManager.prototype.generateCostPrompt = function (destinations, country) {
        var destinationBlocks = destinations.map(function (dest, index) {
            var lines = [];
            lines.push("".concat(index + 1, ". ").concat(dest.name).concat(dest.city ? " (".concat(dest.city, ")") : '', ", ").concat(country));
            if (dest.region) {
                lines.push("   Region: ".concat(dest.region));
            }
            if (dest.arrivalDate || dest.departureDate || dest.durationDays) {
                var dateBits = [];
                if (dest.arrivalDate)
                    dateBits.push("Arrive ".concat(dest.arrivalDate));
                if (dest.departureDate)
                    dateBits.push("Depart ".concat(dest.departureDate));
                dateBits.push("".concat(dest.durationDays, " days"));
                lines.push("   Schedule: ".concat(dateBits.join(' • ')));
            }
            if (dest.activityType) {
                lines.push("   Primary focus: ".concat(dest.activityType));
            }
            var highlights = (dest.highlights || []).slice(0, 5);
            if (highlights.length) {
                lines.push("   Highlights: ".concat(highlights.join(', ')));
            }
            if (dest.notes) {
                lines.push("   Notes: ".concat(dest.notes));
            }
            lines.push("   Local Currency: ".concat(dest.localCurrency));
            lines.push("   Destination ID: ".concat(dest.normalizedId));
            return lines.join('\n');
        }).join('\n\n');
        return "You are the RTW trip cost-planning assistant. Help estimate costs for the destinations below in ".concat(country, ".\n\nFor each destination, produce 3-6 cost line items that cover major spend categories (accommodation, key activities, food, local transport, other notable expenses). Use realistic per-trip totals. Amounts should be in the local currency specified for each destination.\n\nReturn a single JSON array. Each element must follow exactly:\n{\n  \"destination_id\": \"<match the Destination ID>\",\n  \"notes\": \"<optional high-level notes>\",\n  \"costs\": [\n    {\n      \"category\": \"accommodation|activity|food|transport|other\",\n      \"description\": \"<short human-friendly label>\",\n      \"amount\": 0.0,\n      \"currency\": \"<local currency code>\",\n      \"date\": \"YYYY-MM-DD\",\n      \"status\": \"estimated\",\n      \"source\": \"ai_estimate\",\n      \"notes\": \"<optional detail>\"\n    }\n  ]\n}\n\nDestinations to cover:\n\n").concat(destinationBlocks, "\n\nIMPORTANT: Return ONLY the JSON array, no markdown formatting, no explanation text, no code fences. Just the raw JSON array starting with [ and ending with ].");
    };
    BudgetManager.prototype.parseAICostResponse = function (responseText, destinations) {
        var _this = this;
        // Try to extract JSON from the response
        var jsonText = responseText.trim();
        // Remove markdown code fences if present
        jsonText = jsonText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
        // Try to find JSON array in the text
        var jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
        var parsed;
        try {
            parsed = JSON.parse(jsonText);
        }
        catch (error) {
            console.error('Failed to parse AI response:', error);
            console.error('Response text:', responseText);
            throw new Error('Failed to parse AI response as JSON');
        }
        if (!Array.isArray(parsed)) {
            throw new Error('AI response is not an array');
        }
        // Transform the parsed data into costs format
        var allCosts = [];
        parsed.forEach(function (destData) {
            var costs = destData.costs || [];
            costs.forEach(function (cost) {
                var destId = String(destData.destination_id);
                var destination = destinations.find(function (d) { return String(d.id) === destId; });
                if (!destination) {
                    console.warn("Destination ".concat(destId, " not found in provided destinations"));
                    return;
                }
                // Ensure currency is set properly
                var currency = cost.currency || destination.localCurrency || 'USD';
                // Generate cost ID
                var costId = "".concat(destId, "_").concat(cost.category, "_").concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
                // Calculate amount_usd if currency is not USD
                var amountUsd = cost.amount;
                if (currency !== 'USD' && _this.exchangeRates[currency]) {
                    amountUsd = cost.amount / _this.exchangeRates[currency];
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
    };
    BudgetManager.prototype.getCurrenciesForCountry = function (country) {
        var _this = this;
        var countryCosts = (this.tripData.costs || [])
            .filter(function (c) {
            var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
            return (location === null || location === void 0 ? void 0 : location.country) === country;
        });
        var currencies = new Set();
        countryCosts.forEach(function (cost) {
            if (cost.currency && cost.currency !== 'USD') {
                currencies.add(cost.currency);
            }
        });
        return Array.from(currencies);
    };
    BudgetManager.prototype.getAllCurrencies = function () {
        var currencies = new Set();
        (this.tripData.costs || []).forEach(function (cost) {
            if (cost.currency && cost.currency !== 'USD') {
                currencies.add(cost.currency);
            }
        });
        return Array.from(currencies);
    };
    BudgetManager.prototype.updateExchangeRateDisplays = function (country) {
        var _this = this;
        // Update exchange rate displays without full re-render
        var costs = country
            ? (this.tripData.costs || []).filter(function (c) {
                var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
                return (location === null || location === void 0 ? void 0 : location.country) === country;
            })
            : (this.tripData.costs || []);
        costs.forEach(function (cost) {
            var currency = cost.currency || 'USD';
            if (currency === 'USD')
                return;
            var costId = cost.id || "".concat(cost.destination_id, "_").concat(cost.category, "_").concat(Date.now());
            var row = _this.container.querySelector(".editable-cost-row[data-cost-id=\"".concat(costId, "\"]"));
            if (row) {
                var rateInfo = row.querySelector('.exchange-rate-info');
                var rate = _this.exchangeRates[currency] || 1;
                if (rateInfo) {
                    rateInfo.innerHTML = "1 ".concat(currency, " = $").concat((1 / rate).toFixed(4), " USD<br><span class=\"rate-date\">").concat(_this.ratesFetchDate, "</span>");
                }
            }
        });
    };
    BudgetManager.prototype.convertCurrency = function (amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency)
            return amount;
        // Convert to USD first, then to target currency
        var amountInUSD = fromCurrency === 'USD'
            ? amount
            : amount / (this.exchangeRates[fromCurrency] || 1);
        var result = toCurrency === 'USD'
            ? amountInUSD
            : amountInUSD * (this.exchangeRates[toCurrency] || 1);
        return result;
    };
    BudgetManager.prototype.getCurrencySymbol = function (currency) {
        var symbols = {
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
    };
    BudgetManager.prototype.formatCurrencyAmount = function (amount, currency) {
        var symbol = this.getCurrencySymbol(currency);
        var rounded = Math.round(amount);
        return "".concat(symbol).concat(rounded.toLocaleString());
    };
    BudgetManager.prototype.updateData = function (tripData, budget) {
        var _this = this;
        // Save the current open/closed state of country sections before re-rendering
        var openCountries = new Set();
        this.container.querySelectorAll('.item-costs-section').forEach(function (section) {
            var country = section.dataset.country;
            var display = section.style.display;
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
        openCountries.forEach(function (country) {
            var section = _this.container.querySelector(".item-costs-section[data-country=\"".concat(country, "\"]"));
            if (section) {
                section.style.display = 'block';
                // Auto-resize all textareas in restored sections
                section.querySelectorAll('textarea.auto-resize').forEach(function (textarea) {
                    var el = textarea;
                    requestAnimationFrame(function () {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                    });
                });
            }
        });
    };
    BudgetManager.prototype.formatCurrency = function (amount) {
        return "$".concat(Math.round(amount).toLocaleString());
    };
    BudgetManager.prototype.getAlertIcon = function (type) {
        switch (type) {
            case 'exceeded': return '🔴';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📊';
        }
    };
    BudgetManager.prototype.getCategoryColor = function (category) {
        var colors = {
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
    };
    BudgetManager.prototype.getCategoryIcon = function (category) {
        var icons = {
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
    };
    BudgetManager.prototype.renderCostsTableForCountry = function (country) {
        var _this = this;
        var countryCosts = (this.tripData.costs || [])
            .filter(function (c) {
            var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
            return (location === null || location === void 0 ? void 0 : location.country) === country;
        });
        // Get destinations for this country to allow adding new costs
        var countryDestinations = (this.tripData.locations || [])
            .filter(function (loc) { return loc.country === country; });
        var hasChanges = Array.from(this.editedCosts.values()).some(function (cost) {
            var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === cost.destination_id; });
            return (location === null || location === void 0 ? void 0 : location.country) === country;
        });
        if (countryCosts.length === 0) {
            var destinationCount = countryDestinations.length;
            var destinationLabel = destinationCount === 1 ? "".concat(destinationCount, " destination") : "".concat(destinationCount, " destinations");
            return "\n        <div class=\"no-costs-container\">\n          <div class=\"no-costs-message\">\n            <p style=\"margin: 0 0 12px 0;\">No costs recorded for this country yet.</p>\n            <button class=\"btn-primary generate-costs-btn\" data-country=\"".concat(country, "\" data-destinations=\"").concat(countryDestinations.map(function (d) { return d.id; }).join(','), "\">\n              \uD83E\uDD16 Generate AI Cost Estimates for ").concat(destinationLabel, "\n            </button>\n            <p style=\"margin: 12px 0 0 0; font-size: 13px; color: #666;\">\n              Or add costs manually below\n            </p>\n          </div>\n          ").concat(this.renderAddCostSection(country, countryDestinations), "\n        </div>\n      ");
        }
        // Group costs by destination
        var costsByDestination = {};
        countryCosts.forEach(function (cost) {
            var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === cost.destination_id; });
            var destName = (location === null || location === void 0 ? void 0 : location.name) || (location === null || location === void 0 ? void 0 : location.city) || 'Unknown';
            if (!costsByDestination[destName]) {
                costsByDestination[destName] = [];
            }
            costsByDestination[destName].push(cost);
        });
        var countryCurrencies = this.getCurrenciesForCountry(country);
        var hasCurrencies = countryCurrencies.length > 0;
        return "\n      <div class=\"country-costs-table\" data-country=\"".concat(country, "\">\n        <div class=\"costs-table-actions\">\n          <button class=\"btn-sm btn-success add-cost-btn\" data-country=\"").concat(country, "\">+ Add Cost</button>\n          ").concat(hasCurrencies ? "\n            <button class=\"btn-sm btn-secondary refresh-country-rates-btn\" data-country=\"".concat(country, "\" title=\"Refresh exchange rates for ").concat(countryCurrencies.join(', '), "\">\n              \uD83D\uDD04 Refresh Rates (").concat(countryCurrencies.join(', '), ")\n            </button>\n          ") : '', "\n          <span class=\"auto-save-indicator\"></span>\n          <span class=\"rates-fetch-date\">Rates: ").concat(this.ratesFetchDate, "</span>\n        </div>\n        ").concat(Object.entries(costsByDestination).map(function (_a) {
            var destName = _a[0], costs = _a[1];
            return "\n          <div class=\"destination-costs-section\">\n            <div class=\"destination-header\">".concat(destName, "</div>\n            <table class=\"costs-table editable-costs-table\">\n              <thead>\n                <tr>\n                  <th style=\"width: 140px;\">Category</th>\n                  <th style=\"width: 200px;\">Description</th>\n                  <th style=\"width: 80px;\">Currency</th>\n                  <th style=\"width: 100px;\" class=\"text-right\">Amount</th>\n                  <th style=\"width: 100px;\" class=\"text-right\">USD</th>\n                  <th style=\"width: 120px;\">Status</th>\n                  <th style=\"width: 110px;\">Date</th>\n                  <th style=\"width: 200px;\">Notes</th>\n                  <th style=\"width: 60px;\">Actions</th>\n                </tr>\n              </thead>\n              <tbody>\n                ").concat(costs.map(function (cost) { return _this.renderEditableCostRow(cost); }).join(''), "\n              </tbody>\n              <tfoot>\n                <tr class=\"total-row\">\n                  <td colspan=\"4\"><strong>Subtotal for ").concat(destName, "</strong></td>\n                  <td class=\"text-right\"><strong>").concat(_this.formatCurrency(costs.reduce(function (sum, c) { return sum + (c.amount_usd || c.amount || 0); }, 0)), "</strong></td>\n                  <td colspan=\"4\"></td>\n                </tr>\n              </tfoot>\n            </table>\n          </div>\n        ");
        }).join(''), "\n        <div class=\"country-total-row\" data-country=\"").concat(country, "\">\n          <strong>Total for ").concat(country, ":</strong>\n          <strong class=\"country-total-amount\">").concat(this.formatCurrency(countryCosts.reduce(function (sum, c) { return sum + (c.amount_usd || c.amount || 0); }, 0)), "</strong>\n        </div>\n        ").concat(this.renderAddCostSection(country, countryDestinations), "\n      </div>\n    ");
    };
    BudgetManager.prototype.renderEditableCostRow = function (cost) {
        var costId = cost.id || "".concat(cost.destination_id, "_").concat(cost.category, "_").concat(Date.now());
        var amount = cost.amount || 0;
        var amountUsd = cost.amount_usd || amount;
        // Default to local currency if not set
        var currency = cost.currency || (0, currencyMapping_1.getCurrencyForDestination)(cost.destination_id, this.tripData.locations || []);
        // Get exchange rate for display
        var rate = currency === 'USD' ? 1 : (this.exchangeRates[currency] || 1);
        var rateDisplay = currency !== 'USD'
            ? "<div class=\"exchange-rate-info\">1 ".concat(currency, " = $").concat((1 / rate).toFixed(4), " USD<br><span class=\"rate-date\">").concat(this.ratesFetchDate, "</span></div>")
            : '';
        return "\n      <tr class=\"editable-cost-row\" data-cost-id=\"".concat(costId, "\">\n        <td>\n          <span class=\"category-badge\" style=\"background-color: ").concat(this.getCategoryColor(cost.category || 'other'), "\">\n            ").concat(this.getCategoryIcon(cost.category || 'other'), " ").concat((cost.category || 'other').replace(/_/g, ' '), "\n          </span>\n        </td>\n        <td>\n          <input type=\"text\"\n                 class=\"cost-field-input\"\n                 data-cost-id=\"").concat(costId, "\"\n                 data-field=\"description\"\n                 value=\"").concat(cost.description || '', "\"\n                 placeholder=\"Description\">\n        </td>\n        <td>\n          <div class=\"currency-display-wrapper\">\n            <div class=\"currency-code-display\">").concat(currency, "</div>\n            ").concat(rateDisplay, "\n          </div>\n          <input type=\"hidden\"\n                 class=\"currency-field\"\n                 data-cost-id=\"").concat(costId, "\"\n                 data-field=\"currency\"\n                 value=\"").concat(currency, "\">\n        </td>\n        <td class=\"text-right\">\n          <div class=\"currency-input-wrapper\">\n            <span class=\"currency-symbol\">").concat(this.getCurrencySymbol(currency), "</span>\n            <input type=\"number\"\n                   class=\"cost-field-input amount-input\"\n                   data-cost-id=\"").concat(costId, "\"\n                   data-field=\"amount\"\n                   value=\"").concat(Math.round(amount), "\"\n                   step=\"1\"\n                   min=\"0\">\n          </div>\n        </td>\n        <td class=\"text-right\">\n          <div class=\"currency-input-wrapper\">\n            <span class=\"currency-symbol\">$</span>\n            <input type=\"number\"\n                   class=\"cost-field-input usd-input\"\n                   data-cost-id=\"").concat(costId, "\"\n                   data-field=\"amount_usd\"\n                   value=\"").concat(Math.round(amountUsd), "\"\n                   step=\"1\"\n                   min=\"0\"\n                   ").concat(currency === 'USD' ? 'disabled' : '', ">\n          </div>\n        </td>\n        <td>\n          <select class=\"cost-field-select status-select\"\n                  data-cost-id=\"").concat(costId, "\"\n                  data-field=\"status\">\n            <option value=\"estimated\" ").concat((cost.status || 'estimated') === 'estimated' ? 'selected' : '', ">Estimated</option>\n            <option value=\"researched\" ").concat(cost.status === 'researched' ? 'selected' : '', ">Researched</option>\n            <option value=\"booked\" ").concat(cost.status === 'booked' ? 'selected' : '', ">Booked</option>\n            <option value=\"paid\" ").concat(cost.status === 'paid' ? 'selected' : '', ">Paid</option>\n          </select>\n        </td>\n        <td>\n          <input type=\"date\"\n                 class=\"cost-field-input date-input\"\n                 data-cost-id=\"").concat(costId, "\"\n                 data-field=\"date\"\n                 value=\"").concat(cost.date || '', "\">\n        </td>\n        <td>\n          <textarea class=\"cost-field-input notes-input auto-resize\"\n                    data-cost-id=\"").concat(costId, "\"\n                    data-field=\"notes\"\n                    placeholder=\"Notes\"\n                    rows=\"1\">").concat(cost.notes || '', "</textarea>\n        </td>\n        <td>\n          <button class=\"btn-icon delete-cost-btn\" data-cost-id=\"").concat(costId, "\" title=\"Delete cost\">\uD83D\uDDD1\uFE0F</button>\n        </td>\n      </tr>\n    ");
    };
    BudgetManager.prototype.renderAddCostSection = function (country, destinations) {
        return "\n      <div class=\"add-cost-section\" data-country=\"".concat(country, "\" style=\"display: none;\">\n        <div class=\"add-cost-form\">\n          <h5>Add New Cost for ").concat(country, "</h5>\n          <div class=\"form-row\">\n            <div class=\"form-group\">\n              <label>Destination</label>\n              <select class=\"new-cost-field\" data-field=\"destination_id\">\n                <option value=\"\">Select destination...</option>\n                ").concat(destinations.map(function (dest) {
            return "<option value=\"".concat(dest.id, "\">").concat(dest.name || dest.city, "</option>");
        }).join(''), "\n              </select>\n            </div>\n            <div class=\"form-group\">\n              <label>Category</label>\n              <select class=\"new-cost-field\" data-field=\"category\">\n                <option value=\"accommodation\">\uD83C\uDFE8 Accommodation</option>\n                <option value=\"food\">\uD83C\uDF7D\uFE0F Food</option>\n                <option value=\"transport\">\uD83D\uDE97 Transport</option>\n                <option value=\"activity\">\uD83C\uDFAF Activity</option>\n                <option value=\"flight\">\u2708\uFE0F Flight</option>\n                <option value=\"other\">\uD83D\uDCE6 Other</option>\n              </select>\n            </div>\n          </div>\n          <div class=\"form-row\">\n            <div class=\"form-group\">\n              <label>Description</label>\n              <input type=\"text\" class=\"new-cost-field\" data-field=\"description\" placeholder=\"Description\">\n            </div>\n            <div class=\"form-group\">\n              <label>Currency</label>\n              <select class=\"new-cost-field new-cost-currency\" data-field=\"currency\">\n                <option value=\"USD\">USD</option>\n                <option value=\"EUR\">EUR</option>\n                <option value=\"GBP\">GBP</option>\n                <option value=\"JPY\">JPY</option>\n                <option value=\"AUD\">AUD</option>\n                <option value=\"CAD\">CAD</option>\n                <option value=\"CNY\">CNY</option>\n                <option value=\"INR\">INR</option>\n                <option value=\"THB\">THB</option>\n                <option value=\"VND\">VND</option>\n                <option value=\"FJD\">FJD</option>\n                <option value=\"SGD\">SGD</option>\n                <option value=\"NZD\">NZD</option>\n              </select>\n            </div>\n            <div class=\"form-group\">\n              <label>Amount</label>\n              <input type=\"number\" class=\"new-cost-field new-cost-amount\" data-field=\"amount\" step=\"0.01\" min=\"0\" value=\"0\">\n            </div>\n            <div class=\"form-group\">\n              <label>Amount (USD)</label>\n              <input type=\"number\" class=\"new-cost-field new-cost-usd\" data-field=\"amount_usd\" step=\"0.01\" min=\"0\" value=\"0\">\n            </div>\n          </div>\n          <div class=\"form-row\">\n            <div class=\"form-group\">\n              <label>Status</label>\n              <select class=\"new-cost-field\" data-field=\"status\">\n                <option value=\"estimated\">Estimated</option>\n                <option value=\"researched\">Researched</option>\n                <option value=\"booked\">Booked</option>\n                <option value=\"paid\">Paid</option>\n              </select>\n            </div>\n            <div class=\"form-group\">\n              <label>Date</label>\n              <input type=\"date\" class=\"new-cost-field\" data-field=\"date\">\n            </div>\n            <div class=\"form-group\">\n              <label>Notes</label>\n              <input type=\"text\" class=\"new-cost-field\" data-field=\"notes\" placeholder=\"Notes\">\n            </div>\n          </div>\n          <div class=\"form-actions\">\n            <button class=\"btn-sm btn-primary save-new-cost-btn\" data-country=\"").concat(country, "\">Save New Cost</button>\n            <button class=\"btn-sm btn-secondary cancel-new-cost-btn\" data-country=\"").concat(country, "\">Cancel</button>\n          </div>\n        </div>\n      </div>\n    ");
    };
    BudgetManager.prototype.renderCategoryBreakdown = function (costs) {
        var _this = this;
        var categoryTotals = {};
        var total = 0;
        costs.forEach(function (cost) {
            var cat = cost.category || 'other';
            var amount = cost.amount_usd || cost.amount || 0;
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
            total += amount;
        });
        if (total === 0)
            return '';
        return Object.entries(categoryTotals)
            .sort(function (a, b) { return b[1] - a[1]; })
            .map(function (_a) {
            var cat = _a[0], amount = _a[1];
            var pct = (amount / total) * 100;
            var color = _this.getCategoryColor(cat);
            return "<div class=\"cat-breakdown-item\" style=\"background-color: ".concat(color, "\" title=\"").concat(cat.replace(/_/g, ' '), ": ").concat(_this.formatCurrency(amount), " (").concat(pct.toFixed(0), "%)\"></div>");
        })
            .join('');
    };
    BudgetManager.prototype.renderNoBudget = function () {
        var totalCosts = (this.tripData.costs || [])
            .reduce(function (sum, cost) { return sum + (cost.amount_usd || cost.amount || 0); }, 0);
        return "\n      <div class=\"budget-manager no-budget\">\n        <div class=\"budget-header\">\n          <h3>\uD83D\uDCB0 Budget Management</h3>\n          <p class=\"budget-subtitle\">No budget set for this trip</p>\n        </div>\n\n        <div class=\"current-spending\">\n          <div class=\"spending-summary\">\n            <div class=\"spending-label\">Current Total Spending</div>\n            <div class=\"spending-amount\">".concat(this.formatCurrency(totalCosts), "</div>\n          </div>\n        </div>\n\n        <div class=\"budget-actions\">\n          <button class=\"btn-primary\" id=\"create-budget-btn\">\n            Create Budget (+10% Contingency)\n          </button>\n          <button class=\"btn-secondary\" id=\"custom-budget-btn\">\n            Set Custom Budget\n          </button>\n        </div>\n\n        <div class=\"budget-help\">\n          <p>\uD83D\uDCA1 <strong>Tip:</strong> Setting a budget helps you track spending and receive alerts when approaching limits.</p>\n        </div>\n      </div>\n    ");
    };
    BudgetManager.prototype.renderBudgetStatus = function () {
        var _this = this;
        var _a, _b;
        if (!this.budget)
            return this.renderNoBudget();
        var status = (0, budgetTracker_1.calculateBudgetStatus)(this.budget, this.tripData);
        var progressBarClass = status.percentage_used > 100 ? 'over-budget' :
            status.percentage_used > 90 ? 'warning' :
                status.percentage_used > 80 ? 'caution' : '';
        var progressWidth = Math.min(status.percentage_used, 100);
        // Get all categories and countries from trip data
        var categories = new Set();
        var countries = new Set();
        (this.tripData.costs || []).forEach(function (cost) {
            if (cost.category)
                categories.add(cost.category);
        });
        (this.tripData.locations || []).forEach(function (loc) {
            if (loc.country)
                countries.add(loc.country);
        });
        var currentBudget = this.budget.total_budget_usd || 0;
        var allCurrencies = this.getAllCurrencies();
        var hasAnyCurrencies = allCurrencies.length > 0;
        return "\n      <div class=\"budget-manager integrated\">\n        <div class=\"budget-header-compact\">\n          <div class=\"header-row\">\n            <h3>\uD83D\uDCB0 Budget Management</h3>\n            <div class=\"header-actions\">\n              ".concat(hasAnyCurrencies ? "\n                <button class=\"btn-secondary-sm\" id=\"refresh-all-rates-btn\" title=\"Refresh all exchange rates (".concat(allCurrencies.join(', '), ")\">\n                  \uD83D\uDD04 Refresh All Rates\n                </button>\n              ") : '', "\n              <button class=\"btn-primary-sm\" id=\"save-budget-btn\">\uD83D\uDCBE Save</button>\n            </div>\n          </div>\n          <div class=\"budget-overview-compact\">\n            <div class=\"budget-field\">\n              <label>Total:</label>\n              <input type=\"number\" id=\"total-budget\" value=\"").concat(currentBudget, "\" min=\"0\" step=\"100\">\n              <span>USD</span>\n            </div>\n            <div class=\"budget-field\">\n              <label>Contingency:</label>\n              <input type=\"number\" id=\"contingency-pct\" value=\"").concat(this.budget.contingency_pct || 0, "\" min=\"0\" max=\"100\" step=\"1\">\n              <span>%</span>\n            </div>\n            <div class=\"budget-stat\">\n              <span class=\"stat-label\">Estimated:</span>\n              <span class=\"stat-value ").concat(progressBarClass, "\">").concat(this.formatCurrency(status.total_spent), " <span class=\"stat-pct\">(").concat(status.percentage_used.toFixed(1), "%)</span></span>\n            </div>\n            <div class=\"budget-stat\">\n              <span class=\"stat-label\">Remaining:</span>\n              <span class=\"stat-value ").concat(status.total_remaining < 0 ? 'negative' : 'positive', "\">\n                ").concat(this.formatCurrency(status.total_remaining), "\n              </span>\n            </div>\n          </div>\n          <div class=\"budget-progress-compact\">\n            <div class=\"progress-bar ").concat(progressBarClass, "\">\n              <div class=\"progress-fill\" style=\"width: ").concat(progressWidth, "%\"></div>\n            </div>\n          </div>\n        </div>\n\n        <!-- Alerts -->\n        ").concat(status.alerts.length > 0 ? "\n          <div class=\"budget-alerts\">\n            <h4>\uD83D\uDD14 Alerts</h4>\n            ".concat(status.alerts.map(function (alert) { return "\n              <div class=\"budget-alert alert-".concat(alert.type, "\">\n                <span class=\"alert-icon\">").concat(_this.getAlertIcon(alert.type), "</span>\n                <span class=\"alert-message\">").concat(alert.message, "</span>\n              </div>\n            "); }).join(''), "\n          </div>\n        ") : '', "\n\n        <!-- Budget by Country -->\n        ").concat(countries.size > 0 ? "\n          <div class=\"budget-edit-section\">\n            <div class=\"section-header\">\n              <h4>\uD83C\uDF0D Budget by Country</h4>\n              <div class=\"mode-controls\">\n                <span class=\"mode-indicator\" id=\"country-mode-indicator\">Mode: Dollar Amounts</span>\n                <div class=\"country-mode-selector\">\n                  <button class=\"mode-btn active\" data-mode=\"dollars\" id=\"country-mode-dollars\">$</button>\n                  <button class=\"mode-btn\" data-mode=\"percent\" id=\"country-mode-percent\">%</button>\n                  <button class=\"mode-btn\" data-mode=\"perday\" id=\"country-mode-perday\">$/day</button>\n                </div>\n              </div>\n            </div>\n\n            <!-- Group note for countries -->\n            <div class=\"group-note-section\">\n              <label class=\"note-label\">\uD83D\uDCDD Country Budget Notes:</label>\n              <textarea class=\"group-note-input\"\n                        id=\"country-group-note\"\n                        placeholder=\"Add notes about country budgeting strategy...\"\n                        rows=\"2\">".concat(((_a = this.budget) === null || _a === void 0 ? void 0 : _a.country_group_note) || '', "</textarea>\n            </div>\n\n            <!-- Always-visible budget summary for countries -->\n            <div class=\"budget-summary-box\">\n              <div class=\"summary-row\">\n                <span class=\"summary-label\">Total Budget:</span>\n                <span class=\"summary-value\" id=\"country-total-budget\">").concat(this.formatCurrency(currentBudget), "</span>\n              </div>\n              <div class=\"summary-row\">\n                <span class=\"summary-label\">Allocated to Countries:</span>\n                <span class=\"summary-value\" id=\"country-total-allocated\">").concat(this.formatCurrency(Array.from(countries).reduce(function (sum, country) {
            var _a, _b;
            return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0);
        }, 0)), "</span>\n                <span class=\"summary-percentage\" id=\"country-total-pct\">").concat(currentBudget > 0 ?
            ((Array.from(countries).reduce(function (sum, country) { var _a, _b; return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0); }, 0) / currentBudget) * 100).toFixed(1) : 0, "%</span>\n              </div>\n              <div class=\"summary-row\">\n                <span class=\"summary-label\">Unallocated:</span>\n                <span class=\"summary-value\" id=\"country-unallocated\">").concat(this.formatCurrency(currentBudget - Array.from(countries).reduce(function (sum, country) { var _a, _b; return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0); }, 0)), "</span>\n              </div>\n            </div>\n\n            <div id=\"country-allocation-status\" style=\"display: none;\" class=\"allocation-status\">\n              <div class=\"allocation-info\">\n                <strong>Total Allocated:</strong> <span id=\"country-total-allocated-pct\">0</span>%\n              </div>\n              <div id=\"country-allocation-remainder\" class=\"allocation-remainder\"></div>\n            </div>\n\n            <div class=\"budget-items-edit\">\n              ").concat(Array.from(countries).map(function (country) {
            var _a, _b, _c, _d, _e;
            var countryDays = (_this.tripData.locations || [])
                .filter(function (loc) { return loc.country === country; })
                .reduce(function (sum, loc) { return sum + (loc.duration_days || 0); }, 0);
            var countryCostsArray = (_this.tripData.costs || [])
                .filter(function (c) {
                var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
                return (location === null || location === void 0 ? void 0 : location.country) === country;
            });
            var countryCosts = countryCostsArray.reduce(function (sum, c) { return sum + (c.amount_usd || c.amount || 0); }, 0);
            var categoryBreakdown = _this.renderCategoryBreakdown(countryCostsArray);
            var countryBudget = ((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || countryCosts * 1.1;
            var budgetPerDay = countryDays > 0 ? countryBudget / countryDays : 0;
            var countryPct = currentBudget > 0 ? (countryBudget / currentBudget * 100) : 0;
            var pct = ((_c = status.by_country[country]) === null || _c === void 0 ? void 0 : _c.percentage) || 0;
            var barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
            var countryNote = ((_e = (_d = _this.budget) === null || _d === void 0 ? void 0 : _d.country_notes) === null || _e === void 0 ? void 0 : _e[country]) || '';
            return "\n                  <div class=\"budget-item-edit\">\n                    <div class=\"item-header-row\">\n                      <div class=\"item-label-with-note\">\n                        <span class=\"item-label-text\">".concat(country, " <span class=\"days-label\">(").concat(countryDays, " day").concat(countryDays !== 1 ? 's' : '', ")</span></span>\n                        <button class=\"note-toggle-btn\" data-country=\"").concat(country, "\" title=\"").concat(countryNote ? 'Edit Note' : 'Add Note', "\">\n                          ").concat(countryNote ? '📝' : '📄', "\n                        </button>\n                        ").concat(countryNote ? "<span class=\"inline-note\">".concat(countryNote, "</span>") : '', "\n                        <button class=\"costs-toggle-btn\" data-country=\"").concat(country, "\" title=\"View Costs\">\n                          \uD83D\uDCB0 View Costs (").concat(countryCostsArray.length, ")\n                        </button>\n                      </div>\n                    </div>\n                    <div class=\"item-input-row\">\n                      <div class=\"input-with-unit\">\n                        <input type=\"number\"\n                               class=\"country-input\"\n                               data-country=\"").concat(country, "\"\n                               data-days=\"").concat(countryDays, "\"\n                               data-dollar-value=\"").concat(Math.round(countryBudget), "\"\n                               value=\"").concat(Math.round(countryBudget), "\"\n                               min=\"0\"\n                               step=\"10\">\n                        <span class=\"input-unit\" data-country=\"").concat(country, "\">USD</span>\n                      </div>\n                      <span class=\"calc-arrow\">\u2192</span>\n                      <div class=\"calculated-display\">\n                        <span class=\"calc-value\" data-country=\"").concat(country, "\">").concat(countryPct.toFixed(1), "%</span>\n                      </div>\n                      <div class=\"item-status\">\n                        <span class=\"country-per-day-display\" data-country=\"").concat(country, "\">$").concat(Math.round(budgetPerDay), "/day</span>\n                        <div class=\"est-cost-with-breakdown\">\n                          <span class=\"current-spend\">Est: ").concat(_this.formatCurrency(countryCosts), "</span>\n                          ").concat(categoryBreakdown ? "<div class=\"cat-breakdown-bar\">".concat(categoryBreakdown, "</div>") : '', "\n                        </div>\n                        <div class=\"mini-progress-bar ").concat(barClass, "\">\n                          <div class=\"mini-progress-fill\" style=\"width: ").concat(Math.min(pct, 100), "%\"></div>\n                        </div>\n                      </div>\n                    </div>\n                    <div class=\"item-note-section\" data-country=\"").concat(country, "\" style=\"display: none\">\n                      <textarea class=\"item-note-input\"\n                                data-country=\"").concat(country, "\"\n                                placeholder=\"Add notes about this country budget...\"\n                                rows=\"2\">").concat(countryNote, "</textarea>\n                    </div>\n                    <div class=\"item-costs-section\" data-country=\"").concat(country, "\" style=\"display: none\">\n                      ").concat(_this.renderCostsTableForCountry(country), "\n                    </div>\n                  </div>\n                ");
        }).join(''), "\n            </div>\n          </div>\n        ") : '', "\n\n        <!-- Budget by Category -->\n        <div class=\"budget-edit-section\">\n          <div class=\"section-header\">\n            <h4>\uD83D\uDCCA Budget by Category</h4>\n            <div class=\"mode-controls\">\n              <span class=\"mode-indicator\" id=\"category-mode-indicator\">Mode: Dollar Amounts</span>\n              <label class=\"toggle-switch\">\n                <input type=\"checkbox\" id=\"category-mode-toggle\">\n                <span class=\"toggle-slider\"></span>\n                <span class=\"toggle-label\">Use %</span>\n              </label>\n            </div>\n          </div>\n\n          <!-- Group note for categories -->\n          <div class=\"group-note-section\">\n            <label class=\"note-label\">\uD83D\uDCDD Category Budget Notes:</label>\n            <textarea class=\"group-note-input\"\n                      id=\"category-group-note\"\n                      placeholder=\"Add notes about category budgeting strategy...\"\n                      rows=\"2\">").concat(((_b = this.budget) === null || _b === void 0 ? void 0 : _b.category_group_note) || '', "</textarea>\n          </div>\n\n          <!-- Always-visible budget summary -->\n          <div class=\"budget-summary-box\">\n            <div class=\"summary-row\">\n              <span class=\"summary-label\">Total Budget:</span>\n              <span class=\"summary-value\" id=\"category-total-budget\">").concat(this.formatCurrency(currentBudget), "</span>\n            </div>\n            <div class=\"summary-row\">\n              <span class=\"summary-label\">Allocated to Categories:</span>\n              <span class=\"summary-value\" id=\"category-total-allocated\">").concat(this.formatCurrency(Array.from(categories).reduce(function (sum, cat) {
            var _a, _b;
            return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0);
        }, 0)), "</span>\n              <span class=\"summary-percentage\" id=\"category-total-pct\">").concat(currentBudget > 0 ?
            ((Array.from(categories).reduce(function (sum, cat) { var _a, _b; return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0); }, 0) / currentBudget) * 100).toFixed(1) : 0, "%</span>\n            </div>\n            <div class=\"summary-row\">\n              <span class=\"summary-label\">Unallocated:</span>\n              <span class=\"summary-value\" id=\"category-unallocated\">").concat(this.formatCurrency(currentBudget - Array.from(categories).reduce(function (sum, cat) { var _a, _b; return sum + (((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0); }, 0)), "</span>\n            </div>\n          </div>\n\n          <div id=\"allocation-status\" style=\"display: none;\" class=\"allocation-status\">\n            <div class=\"allocation-info\">\n              <strong>Total Allocated:</strong> <span id=\"total-allocated-pct\">0</span>%\n            </div>\n            <div id=\"allocation-remainder\" class=\"allocation-remainder\"></div>\n          </div>\n\n          <div class=\"budget-items-edit\">\n            ").concat(Array.from(categories).map(function (cat) {
            var _a, _b, _c, _d, _e;
            var catCosts = (_this.tripData.costs || [])
                .filter(function (c) { return c.category === cat; })
                .reduce(function (sum, c) { return sum + (c.amount_usd || c.amount || 0); }, 0);
            var catBudget = ((_b = (_a = _this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || catCosts * 1.1;
            var catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
            var pct = ((_c = status.by_category[cat]) === null || _c === void 0 ? void 0 : _c.percentage) || 0;
            var barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
            var catNote = ((_e = (_d = _this.budget) === null || _d === void 0 ? void 0 : _d.category_notes) === null || _e === void 0 ? void 0 : _e[cat]) || '';
            return "\n                <div class=\"budget-item-edit\">\n                  <div class=\"item-header-row\">\n                    <div class=\"item-label-with-note\">\n                      <span class=\"item-label-text\">".concat(cat.replace(/_/g, ' '), "</span>\n                      <button class=\"note-toggle-btn\" data-category=\"").concat(cat, "\" title=\"").concat(catNote ? 'Edit Note' : 'Add Note', "\">\n                        ").concat(catNote ? '📝' : '📄', "\n                      </button>\n                      ").concat(catNote ? "<span class=\"inline-note\">".concat(catNote, "</span>") : '', "\n                    </div>\n                  </div>\n                  <div class=\"item-input-row\">\n                    <div class=\"input-with-unit\">\n                      <input type=\"number\"\n                             class=\"cat-input\"\n                             data-category=\"").concat(cat, "\"\n                             data-dollar-value=\"").concat(Math.round(catBudget), "\"\n                             value=\"").concat(Math.round(catBudget), "\"\n                             min=\"0\"\n                             step=\"10\">\n                      <span class=\"input-unit\" data-category=\"").concat(cat, "\">USD</span>\n                    </div>\n                    <span class=\"calc-arrow\">\u2192</span>\n                    <div class=\"calculated-display\">\n                      <span class=\"calc-value\" data-category=\"").concat(cat, "\">").concat(catPct.toFixed(1), "%</span>\n                    </div>\n                    <div class=\"item-status\">\n                      <span class=\"current-spend\">Est: ").concat(_this.formatCurrency(catCosts), "</span>\n                      <div class=\"mini-progress-bar ").concat(barClass, "\">\n                        <div class=\"mini-progress-fill\" style=\"width: ").concat(Math.min(pct, 100), "%\"></div>\n                      </div>\n                    </div>\n                  </div>\n                  <div class=\"item-note-section\" data-category=\"").concat(cat, "\" style=\"display: none\">\n                    <textarea class=\"item-note-input\"\n                              data-category=\"").concat(cat, "\"\n                              placeholder=\"Add notes about this category budget...\"\n                              rows=\"2\">").concat(catNote, "</textarea>\n                  </div>\n                </div>\n              ");
        }).join(''), "\n          </div>\n        </div>\n\n        <div class=\"budget-footer\">\n          <button class=\"btn-primary\" id=\"save-budget-btn-footer\">\uD83D\uDCBE Save Budget</button>\n        </div>\n      </div>\n    ");
    };
    BudgetManager.prototype.attachEventListeners = function () {
        var _this = this;
        // Create budget button
        var createBtn = this.container.querySelector('#create-budget-btn');
        createBtn === null || createBtn === void 0 ? void 0 : createBtn.addEventListener('click', function () {
            var _a;
            var newBudget = (0, budgetTracker_1.createDefaultBudget)(_this.tripData, 10);
            _this.budget = newBudget;
            (_a = _this.onBudgetUpdate) === null || _a === void 0 ? void 0 : _a.call(_this, newBudget);
            _this.render();
        });
        // Custom budget button
        var customBtn = this.container.querySelector('#custom-budget-btn');
        customBtn === null || customBtn === void 0 ? void 0 : customBtn.addEventListener('click', function () {
            var _a;
            var newBudget = (0, budgetTracker_1.createDefaultBudget)(_this.tripData, 10);
            _this.budget = newBudget;
            (_a = _this.onBudgetUpdate) === null || _a === void 0 ? void 0 : _a.call(_this, newBudget);
            _this.render();
        });
        // If budget exists, attach integrated edit listeners
        if (this.budget) {
            this.attachBudgetEditListeners();
        }
    };
    BudgetManager.prototype.attachBudgetEditListeners = function () {
        var _this = this;
        var _a, _b;
        var totalBudgetInput = this.container.querySelector('#total-budget');
        var contingencyInput = this.container.querySelector('#contingency-pct');
        if (!totalBudgetInput)
            return;
        // Category mode toggle logic
        var categoryModeToggle = this.container.querySelector('#category-mode-toggle');
        var categoryModeIndicator = this.container.querySelector('#category-mode-indicator');
        var allocationStatus = this.container.querySelector('#allocation-status');
        var totalAllocatedSpan = this.container.querySelector('#total-allocated-pct');
        var allocationRemainder = this.container.querySelector('#allocation-remainder');
        var isPercentageMode = false;
        // Update budget summary for categories
        var updateCategorySummary = function () {
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            var totalAllocated = 0;
            _this.container.querySelectorAll('.cat-input').forEach(function (input) {
                var el = input;
                var dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                totalAllocated += dollarValue;
            });
            var categoryTotalBudgetEl = _this.container.querySelector('#category-total-budget');
            var categoryTotalEl = _this.container.querySelector('#category-total-allocated');
            var categoryPctEl = _this.container.querySelector('#category-total-pct');
            var categoryUnallocatedEl = _this.container.querySelector('#category-unallocated');
            // Update total budget display
            if (categoryTotalBudgetEl) {
                categoryTotalBudgetEl.textContent = "$".concat(Math.round(totalBudget).toLocaleString());
            }
            if (categoryTotalEl) {
                categoryTotalEl.textContent = "$".concat(totalAllocated.toLocaleString());
            }
            if (categoryPctEl) {
                var pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
                categoryPctEl.textContent = "".concat(pct.toFixed(1), "%");
                // Color code based on allocation status
                if (Math.abs(pct - 100) < 0.1) {
                    categoryPctEl.style.color = '#28a745'; // Green for fully allocated
                }
                else if (pct > 100) {
                    categoryPctEl.style.color = '#dc3545'; // Red for over-allocated
                }
                else {
                    categoryPctEl.style.color = '#ffc107'; // Orange for under-allocated
                }
            }
            if (categoryUnallocatedEl) {
                var unallocated = totalBudget - totalAllocated;
                categoryUnallocatedEl.textContent = "$".concat(unallocated.toLocaleString());
                // Color code the unallocated amount
                if (Math.abs(unallocated) < 1) {
                    categoryUnallocatedEl.style.color = '#28a745';
                }
                else if (unallocated < 0) {
                    categoryUnallocatedEl.style.color = '#dc3545';
                }
                else {
                    categoryUnallocatedEl.style.color = '#ffc107';
                }
            }
        };
        // Update calculated displays for categories
        var updateCalculatedDisplays = function () {
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            _this.container.querySelectorAll('.cat-input').forEach(function (input) {
                var el = input;
                var category = el.dataset.category;
                var calcValueSpan = _this.container.querySelector(".calc-value[data-category=\"".concat(category, "\"]"));
                if (isPercentageMode) {
                    var pct = parseFloat(el.value) || 0;
                    var dollars = Math.round(totalBudget * pct / 100);
                    calcValueSpan.textContent = "$".concat(dollars.toLocaleString());
                    el.dataset.dollarValue = dollars.toString();
                }
                else {
                    var dollars = parseFloat(el.value) || 0;
                    var pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    calcValueSpan.textContent = "".concat(pct.toFixed(1), "%");
                    el.dataset.dollarValue = dollars.toString();
                }
            });
            if (isPercentageMode) {
                updateAllocationStatus();
            }
            updateCategorySummary();
        };
        // Update allocation status for categories
        var updateAllocationStatus = function () {
            var totalPct = 0;
            _this.container.querySelectorAll('.cat-input').forEach(function (input) {
                var el = input;
                totalPct += parseFloat(el.value) || 0;
            });
            totalAllocatedSpan.textContent = totalPct.toFixed(1);
            var remainder = 100 - totalPct;
            var absRemainder = Math.abs(remainder);
            if (Math.abs(remainder) < 0.1) {
                allocationRemainder.textContent = '✓ Fully Allocated';
                allocationRemainder.style.color = '#28a745';
            }
            else if (remainder > 0) {
                allocationRemainder.textContent = "".concat(absRemainder.toFixed(1), "% Unallocated");
                allocationRemainder.style.color = '#ffc107';
            }
            else {
                allocationRemainder.textContent = "".concat(absRemainder.toFixed(1), "% Over-allocated");
                allocationRemainder.style.color = '#dc3545';
            }
        };
        // Category toggle between % and $
        categoryModeToggle === null || categoryModeToggle === void 0 ? void 0 : categoryModeToggle.addEventListener('change', function () {
            isPercentageMode = categoryModeToggle.checked;
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            categoryModeIndicator.textContent = isPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
            allocationStatus.style.display = isPercentageMode ? 'block' : 'none';
            _this.container.querySelectorAll('.cat-input').forEach(function (input) {
                var el = input;
                var category = el.dataset.category;
                var unitSpan = _this.container.querySelector(".input-unit[data-category=\"".concat(category, "\"]"));
                var currentDollarValue = parseFloat(el.dataset.dollarValue) || parseFloat(el.value) || 0;
                if (isPercentageMode) {
                    var pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
                    el.value = pct.toFixed(1);
                    el.step = '0.1';
                    el.max = '100';
                    unitSpan.textContent = '%';
                }
                else {
                    el.value = Math.round(currentDollarValue).toString();
                    el.step = '10';
                    el.removeAttribute('max');
                    unitSpan.textContent = 'USD';
                }
            });
            updateCalculatedDisplays();
        });
        // Update category displays when inputs change
        this.container.querySelectorAll('.cat-input').forEach(function (input) {
            input.addEventListener('input', function () {
                updateCalculatedDisplays();
            });
        });
        // Update when total budget changes
        totalBudgetInput.addEventListener('input', function () {
            updateCalculatedDisplays();
            updateCountryCalculatedDisplays();
        });
        // Country mode selector logic
        var countryModeIndicator = this.container.querySelector('#country-mode-indicator');
        var countryAllocationStatus = this.container.querySelector('#country-allocation-status');
        var countryTotalAllocatedSpan = this.container.querySelector('#country-total-allocated-pct');
        var countryAllocationRemainder = this.container.querySelector('#country-allocation-remainder');
        var countryMode = 'dollars';
        // Update budget summary for countries
        var updateCountrySummary = function () {
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            var totalAllocated = 0;
            _this.container.querySelectorAll('.country-input').forEach(function (input) {
                var el = input;
                var dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                totalAllocated += dollarValue;
            });
            var countryTotalBudgetEl = _this.container.querySelector('#country-total-budget');
            var countryTotalEl = _this.container.querySelector('#country-total-allocated');
            var countryPctEl = _this.container.querySelector('#country-total-pct');
            var countryUnallocatedEl = _this.container.querySelector('#country-unallocated');
            // Update total budget display
            if (countryTotalBudgetEl) {
                countryTotalBudgetEl.textContent = "$".concat(Math.round(totalBudget).toLocaleString());
            }
            if (countryTotalEl) {
                countryTotalEl.textContent = "$".concat(totalAllocated.toLocaleString());
            }
            if (countryPctEl) {
                var pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
                countryPctEl.textContent = "".concat(pct.toFixed(1), "%");
                // Color code based on allocation status
                if (Math.abs(pct - 100) < 0.1) {
                    countryPctEl.style.color = '#28a745'; // Green for fully allocated
                }
                else if (pct > 100) {
                    countryPctEl.style.color = '#dc3545'; // Red for over-allocated
                }
                else {
                    countryPctEl.style.color = '#ffc107'; // Orange for under-allocated
                }
            }
            if (countryUnallocatedEl) {
                var unallocated = totalBudget - totalAllocated;
                countryUnallocatedEl.textContent = "$".concat(unallocated.toLocaleString());
                // Color code the unallocated amount
                if (Math.abs(unallocated) < 1) {
                    countryUnallocatedEl.style.color = '#28a745';
                }
                else if (unallocated < 0) {
                    countryUnallocatedEl.style.color = '#dc3545';
                }
                else {
                    countryUnallocatedEl.style.color = '#ffc107';
                }
            }
        };
        // Update calculated displays for countries
        var updateCountryCalculatedDisplays = function () {
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            _this.container.querySelectorAll('.country-input').forEach(function (input) {
                var el = input;
                var country = el.dataset.country;
                var days = parseFloat(el.dataset.days) || 1;
                var calcValueSpan = _this.container.querySelector(".calc-value[data-country=\"".concat(country, "\"]"));
                var perDayDisplay = _this.container.querySelector(".country-per-day-display[data-country=\"".concat(country, "\"]"));
                if (countryMode === 'percent') {
                    var pct = parseFloat(el.value) || 0;
                    var dollars = Math.round(totalBudget * pct / 100);
                    var perDay = days > 0 ? Math.round(dollars / days) : 0;
                    calcValueSpan.textContent = "$".concat(dollars.toLocaleString());
                    perDayDisplay.textContent = "$".concat(perDay, "/day");
                    el.dataset.dollarValue = dollars.toString();
                }
                else if (countryMode === 'perday') {
                    var perDay = parseFloat(el.value) || 0;
                    var dollars = Math.round(perDay * days);
                    var pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    calcValueSpan.textContent = "$".concat(dollars.toLocaleString());
                    perDayDisplay.textContent = "".concat(pct.toFixed(1), "%");
                    el.dataset.dollarValue = dollars.toString();
                }
                else {
                    var dollars = parseFloat(el.value) || 0;
                    var pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    var perDay = days > 0 ? Math.round(dollars / days) : 0;
                    calcValueSpan.textContent = "".concat(pct.toFixed(1), "%");
                    perDayDisplay.textContent = "$".concat(perDay, "/day");
                    el.dataset.dollarValue = dollars.toString();
                }
            });
            if (countryMode === 'percent') {
                updateCountryAllocationStatus();
            }
            updateCountrySummary();
        };
        // Update allocation status for countries
        var updateCountryAllocationStatus = function () {
            var totalPct = 0;
            _this.container.querySelectorAll('.country-input').forEach(function (input) {
                var el = input;
                totalPct += parseFloat(el.value) || 0;
            });
            countryTotalAllocatedSpan.textContent = totalPct.toFixed(1);
            var remainder = 100 - totalPct;
            var absRemainder = Math.abs(remainder);
            if (Math.abs(remainder) < 0.1) {
                countryAllocationRemainder.textContent = '✓ Fully Allocated';
                countryAllocationRemainder.style.color = '#28a745';
            }
            else if (remainder > 0) {
                countryAllocationRemainder.textContent = "".concat(absRemainder.toFixed(1), "% Unallocated");
                countryAllocationRemainder.style.color = '#ffc107';
            }
            else {
                countryAllocationRemainder.textContent = "".concat(absRemainder.toFixed(1), "% Over-allocated");
                countryAllocationRemainder.style.color = '#dc3545';
            }
        };
        // Country mode selector buttons
        var countryModeBtns = this.container.querySelectorAll('.country-mode-selector .mode-btn');
        countryModeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var newMode = btn.dataset.mode;
                countryMode = newMode;
                var totalBudget = parseFloat(totalBudgetInput.value) || 0;
                // Update button states
                countryModeBtns.forEach(function (b) { return b.classList.remove('active'); });
                btn.classList.add('active');
                // Update indicator
                var modeText = newMode === 'dollars' ? 'Dollar Amounts' : newMode === 'percent' ? 'Percentages' : 'Per Day';
                countryModeIndicator.textContent = "Mode: ".concat(modeText);
                countryAllocationStatus.style.display = newMode === 'percent' ? 'block' : 'none';
                // Convert all inputs to new mode
                _this.container.querySelectorAll('.country-input').forEach(function (input) {
                    var el = input;
                    var country = el.dataset.country;
                    var days = parseFloat(el.dataset.days) || 1;
                    var unitSpan = _this.container.querySelector(".input-unit[data-country=\"".concat(country, "\"]"));
                    var currentDollarValue = parseFloat(el.dataset.dollarValue) || parseFloat(el.value) || 0;
                    if (newMode === 'percent') {
                        var pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
                        el.value = pct.toFixed(1);
                        el.step = '0.1';
                        el.max = '100';
                        unitSpan.textContent = '%';
                    }
                    else if (newMode === 'perday') {
                        var perDay = days > 0 ? Math.round(currentDollarValue / days) : 0;
                        el.value = perDay.toString();
                        el.step = '1';
                        el.removeAttribute('max');
                        unitSpan.textContent = '$/day';
                    }
                    else {
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
        this.container.querySelectorAll('.country-input').forEach(function (input) {
            input.addEventListener('input', function () {
                updateCountryCalculatedDisplays();
            });
        });
        // Note toggle functionality for categories
        this.container.querySelectorAll('.note-toggle-btn[data-category]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var category = btn.dataset.category;
                var noteSection = _this.container.querySelector(".item-note-section[data-category=\"".concat(category, "\"]"));
                if (noteSection) {
                    var isVisible = noteSection.style.display !== 'none';
                    noteSection.style.display = isVisible ? 'none' : 'block';
                }
            });
        });
        // Note toggle functionality for countries
        this.container.querySelectorAll('.note-toggle-btn[data-country]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var country = btn.dataset.country;
                var noteSection = _this.container.querySelector(".item-note-section[data-country=\"".concat(country, "\"]"));
                if (noteSection) {
                    var isVisible = noteSection.style.display !== 'none';
                    noteSection.style.display = isVisible ? 'none' : 'block';
                }
            });
        });
        // Costs toggle functionality for countries
        this.container.querySelectorAll('.costs-toggle-btn[data-country]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var country = btn.dataset.country;
                var costsSection = _this.container.querySelector(".item-costs-section[data-country=\"".concat(country, "\"]"));
                if (costsSection) {
                    var isVisible = costsSection.style.display !== 'none';
                    costsSection.style.display = isVisible ? 'none' : 'block';
                    // Update button text to indicate state
                    var btnElement = btn;
                    if (isVisible) {
                        btnElement.innerHTML = btnElement.innerHTML.replace('▼', '▶').replace('Hide', 'View');
                    }
                    else {
                        btnElement.innerHTML = btnElement.innerHTML.replace('▶', '▼').replace('View', 'Hide');
                        // Auto-resize all textareas in this section when opening
                        costsSection.querySelectorAll('textarea.auto-resize').forEach(function (textarea) {
                            var el = textarea;
                            requestAnimationFrame(function () {
                                el.style.height = 'auto';
                                el.style.height = el.scrollHeight + 'px';
                            });
                        });
                    }
                }
            });
        });
        // Save budget functionality
        var saveBudget = function () {
            var _a, _b, _c;
            var totalBudget = parseFloat(totalBudgetInput.value) || 0;
            var contingency = parseFloat(contingencyInput.value) || 0;
            // Collect category budgets - use stored dollar values
            var budgets_by_category = {};
            _this.container.querySelectorAll('.cat-input').forEach(function (input) {
                var el = input;
                var category = el.dataset.category;
                var dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                budgets_by_category[category] = dollarValue;
            });
            // Collect country budgets - use stored dollar values
            var budgets_by_country = {};
            _this.container.querySelectorAll('.country-input').forEach(function (input) {
                var el = input;
                var country = el.dataset.country;
                var dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                budgets_by_country[country] = dollarValue;
            });
            // Collect category notes
            var category_notes = {};
            _this.container.querySelectorAll('.item-note-input[data-category]').forEach(function (textarea) {
                var el = textarea;
                var category = el.dataset.category;
                var note = el.value.trim();
                if (note) {
                    category_notes[category] = note;
                }
            });
            // Collect country notes
            var country_notes = {};
            _this.container.querySelectorAll('.item-note-input[data-country]').forEach(function (textarea) {
                var el = textarea;
                var country = el.dataset.country;
                var note = el.value.trim();
                if (note) {
                    country_notes[country] = note;
                }
            });
            // Get group notes
            var categoryGroupNote = (_a = _this.container.querySelector('#category-group-note')) === null || _a === void 0 ? void 0 : _a.value.trim();
            var countryGroupNote = (_b = _this.container.querySelector('#country-group-note')) === null || _b === void 0 ? void 0 : _b.value.trim();
            // Build budget object, only including note fields if they have values
            var newBudget = {
                total_budget_usd: totalBudget,
                budgets_by_category: budgets_by_category,
                budgets_by_country: budgets_by_country,
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
            _this.budget = newBudget;
            (_c = _this.onBudgetUpdate) === null || _c === void 0 ? void 0 : _c.call(_this, newBudget);
            _this.render();
        };
        // Attach save listeners to both buttons
        (_a = this.container.querySelector('#save-budget-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', saveBudget);
        (_b = this.container.querySelector('#save-budget-btn-footer')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', saveBudget);
        // Attach cost editing listeners
        this.attachCostEditingListeners();
    };
    BudgetManager.prototype.attachCostEditingListeners = function () {
        var _this = this;
        // Inline editing of cost fields - use 'input' for real-time updates
        this.container.querySelectorAll('.cost-field-input, .cost-field-select').forEach(function (field) {
            var inputEl = field;
            var handleChange = function () {
                var costId = inputEl.dataset.costId;
                var fieldName = inputEl.dataset.field;
                // Find the original cost
                var originalCost = (_this.tripData.costs || []).find(function (c) {
                    return (c.id || "".concat(c.destination_id, "_").concat(c.category, "_").concat(Date.now())) === costId;
                });
                if (!originalCost)
                    return;
                // Get or create edited cost entry
                var editedCost = _this.editedCosts.get(costId);
                if (!editedCost) {
                    editedCost = __assign(__assign({}, originalCost), { id: costId });
                    _this.editedCosts.set(costId, editedCost);
                }
                // Update the field
                if (inputEl.type === 'number') {
                    editedCost[fieldName] = parseFloat(inputEl.value) || 0;
                }
                else {
                    editedCost[fieldName] = inputEl.value;
                }
                // Special handling for currency changes
                if (fieldName === 'currency') {
                    var currency = inputEl.value;
                    var row = inputEl.closest('tr');
                    var amountInput = row === null || row === void 0 ? void 0 : row.querySelector('.amount-input');
                    var usdInput = row === null || row === void 0 ? void 0 : row.querySelector('.usd-input');
                    var currencySymbol = row === null || row === void 0 ? void 0 : row.querySelector('.currency-symbol');
                    if (currencySymbol) {
                        currencySymbol.textContent = _this.getCurrencySymbol(currency);
                    }
                    if (currency === 'USD') {
                        // Disable USD input and sync with amount
                        if (usdInput && amountInput) {
                            usdInput.disabled = true;
                            usdInput.value = amountInput.value;
                            editedCost.amount_usd = parseFloat(amountInput.value) || 0;
                        }
                    }
                    else {
                        // Enable USD input and auto-convert
                        if (usdInput && amountInput) {
                            usdInput.disabled = false;
                            var amount = parseFloat(amountInput.value) || 0;
                            var convertedUsd = _this.convertCurrency(amount, currency, 'USD');
                            usdInput.value = Math.round(convertedUsd).toString();
                            editedCost.amount_usd = Math.round(convertedUsd);
                        }
                    }
                    // Update exchange rate display without full re-render
                    var rateInfo = row === null || row === void 0 ? void 0 : row.querySelector('.exchange-rate-info');
                    if (rateInfo && currency !== 'USD') {
                        var rate = _this.exchangeRates[currency] || 1;
                        rateInfo.textContent = "1 USD = ".concat(_this.getCurrencySymbol(currency)).concat(rate.toFixed(2));
                        rateInfo.setAttribute('title', "Rate as of ".concat(_this.ratesFetchDate));
                    }
                    else if (rateInfo) {
                        rateInfo.textContent = '';
                    }
                }
                // If amount changes, auto-convert to USD
                if (fieldName === 'amount') {
                    var row = inputEl.closest('tr');
                    var currencyField = row === null || row === void 0 ? void 0 : row.querySelector('.currency-field');
                    var usdInput = row === null || row === void 0 ? void 0 : row.querySelector('.usd-input');
                    var currency = (currencyField === null || currencyField === void 0 ? void 0 : currencyField.value) || editedCost.currency || 'USD';
                    var amount = parseFloat(inputEl.value) || 0;
                    if (usdInput) {
                        if (currency === 'USD') {
                            usdInput.value = inputEl.value;
                            editedCost.amount_usd = amount;
                        }
                        else {
                            var convertedUsd = _this.convertCurrency(amount, currency, 'USD');
                            usdInput.value = Math.round(convertedUsd).toString();
                            editedCost.amount_usd = Math.round(convertedUsd);
                        }
                    }
                }
                // If USD amount changes, reverse calculate original currency amount
                if (fieldName === 'amount_usd') {
                    var row = inputEl.closest('tr');
                    var currencyField = row === null || row === void 0 ? void 0 : row.querySelector('.currency-field');
                    var amountInput = row === null || row === void 0 ? void 0 : row.querySelector('.amount-input');
                    var currency = (currencyField === null || currencyField === void 0 ? void 0 : currencyField.value) || editedCost.currency || 'USD';
                    var usdAmount = parseFloat(inputEl.value) || 0;
                    if (amountInput && currency !== 'USD') {
                        var convertedAmount = _this.convertCurrency(usdAmount, 'USD', currency);
                        amountInput.value = Math.round(convertedAmount).toString();
                        editedCost.amount = Math.round(convertedAmount);
                    }
                }
                // Schedule auto-save instead of immediate render
                _this.scheduleAutoSave();
            };
            // Use 'input' for text/number fields for real-time updates
            if (inputEl.type === 'number' || inputEl.type === 'text' || inputEl.type === 'date') {
                inputEl.addEventListener('input', handleChange);
            }
            else {
                // Use 'change' for selects
                inputEl.addEventListener('change', handleChange);
            }
        });
        // Auto-resize textareas
        this.setupAutoResizeTextareas();
        // Add cost button
        this.container.querySelectorAll('.add-cost-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var country = btn.dataset.country;
                var addSection = _this.container.querySelector(".add-cost-section[data-country=\"".concat(country, "\"]"));
                if (addSection) {
                    var isOpening = addSection.style.display === 'none';
                    addSection.style.display = isOpening ? 'block' : 'none';
                    // Set default currency to local currency when opening the form
                    if (isOpening) {
                        var currencySelect = addSection.querySelector('.new-cost-currency');
                        if (currencySelect) {
                            // Find the first destination in this country to get its currency
                            var destinations = (_this.tripData.locations || []).filter(function (loc) { return loc.country === country; });
                            if (destinations.length > 0) {
                                var localCurrency = (0, currencyMapping_1.getCurrencyForDestination)(destinations[0].id, _this.tripData.locations || []);
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
        this.container.querySelectorAll('.cancel-new-cost-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var country = btn.dataset.country;
                var addSection = _this.container.querySelector(".add-cost-section[data-country=\"".concat(country, "\"]"));
                if (addSection) {
                    addSection.style.display = 'none';
                    // Reset form
                    addSection.querySelectorAll('.new-cost-field').forEach(function (field) {
                        var input = field;
                        if (input.type === 'number') {
                            input.value = '0';
                        }
                        else {
                            input.value = '';
                        }
                    });
                }
            });
        });
        // Currency sync for new cost form
        this.container.querySelectorAll('.new-cost-currency').forEach(function (currencySelect) {
            currencySelect.addEventListener('change', function () {
                var form = currencySelect.closest('.add-cost-form');
                var amountInput = form === null || form === void 0 ? void 0 : form.querySelector('.new-cost-amount');
                var usdInput = form === null || form === void 0 ? void 0 : form.querySelector('.new-cost-usd');
                if (currencySelect.value === 'USD') {
                    if (usdInput) {
                        usdInput.disabled = true;
                        usdInput.value = (amountInput === null || amountInput === void 0 ? void 0 : amountInput.value) || '0';
                    }
                }
                else {
                    if (usdInput) {
                        usdInput.disabled = false;
                    }
                }
            });
        });
        // Amount sync when currency is USD for new cost form
        this.container.querySelectorAll('.new-cost-amount').forEach(function (amountInput) {
            amountInput.addEventListener('input', function () {
                var form = amountInput.closest('.add-cost-form');
                var currencySelect = form === null || form === void 0 ? void 0 : form.querySelector('.new-cost-currency');
                var usdInput = form === null || form === void 0 ? void 0 : form.querySelector('.new-cost-usd');
                if ((currencySelect === null || currencySelect === void 0 ? void 0 : currencySelect.value) === 'USD' && usdInput) {
                    usdInput.value = amountInput.value;
                }
            });
        });
        // Save new cost button
        this.container.querySelectorAll('.save-new-cost-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { return __awaiter(_this, void 0, void 0, function () {
                var country, addSection, newCost;
                return __generator(this, function (_a) {
                    country = btn.dataset.country;
                    addSection = this.container.querySelector(".add-cost-section[data-country=\"".concat(country, "\"]"));
                    if (!addSection)
                        return [2 /*return*/];
                    newCost = { status: 'estimated' };
                    addSection.querySelectorAll('.new-cost-field').forEach(function (field) {
                        var input = field;
                        var fieldName = input.dataset.field;
                        if (input.type === 'number') {
                            newCost[fieldName] = parseFloat(input.value) || 0;
                        }
                        else {
                            newCost[fieldName] = input.value;
                        }
                    });
                    // Validate required fields
                    if (!newCost.destination_id || !newCost.category) {
                        alert('Please select a destination and category');
                        return [2 /*return*/];
                    }
                    // Generate ID for new cost
                    newCost.id = "".concat(newCost.destination_id, "_").concat(newCost.category, "_").concat(Date.now());
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
                    return [2 /*return*/];
                });
            }); });
        });
        // Delete cost button
        this.container.querySelectorAll('.delete-cost-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Are you sure you want to delete this cost?'))
                    return;
                var costId = btn.dataset.costId;
                // Mark for deletion by setting a special flag
                var costIndex = (_this.tripData.costs || []).findIndex(function (c) {
                    return (c.id || "".concat(c.destination_id, "_").concat(c.category, "_").concat(Date.now())) === costId;
                });
                if (costIndex !== -1) {
                    var deletedCost = __assign(__assign({}, _this.tripData.costs[costIndex]), { _deleted: true });
                    _this.editedCosts.set(costId, deletedCost);
                    _this.tripData.costs.splice(costIndex, 1);
                    _this.render();
                }
            });
        });
        // Refresh country rates button
        this.container.querySelectorAll('.refresh-country-rates-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { return __awaiter(_this, void 0, void 0, function () {
                var country, currencies, originalText, ratesDateEl, countrySection, error_4;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            country = btn.dataset.country;
                            currencies = this.getCurrenciesForCountry(country);
                            if (currencies.length === 0)
                                return [2 /*return*/];
                            originalText = btn.textContent;
                            btn.textContent = '⏳ Refreshing...';
                            btn.disabled = true;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, 4, 5]);
                            return [4 /*yield*/, this.refreshExchangeRates(currencies)];
                        case 2:
                            _b.sent();
                            ratesDateEl = (_a = btn.closest('.costs-table-actions')) === null || _a === void 0 ? void 0 : _a.querySelector('.rates-fetch-date');
                            if (ratesDateEl) {
                                ratesDateEl.textContent = "Rates: ".concat(this.ratesFetchDate);
                            }
                            countrySection = this.container.querySelector(".item-costs-section[data-country=\"".concat(country, "\"]"));
                            if (countrySection) {
                                countrySection.querySelectorAll('.exchange-rate-info').forEach(function (rateInfo) {
                                    var el = rateInfo;
                                    el.style.transition = 'background-color 0.3s ease';
                                    el.style.backgroundColor = '#d4edda';
                                    el.style.padding = '4px 6px';
                                    el.style.borderRadius = '3px';
                                    // Remove highlight after 2 seconds
                                    setTimeout(function () {
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
                            setTimeout(function () {
                                btn.textContent = originalText;
                            }, 1500);
                            return [3 /*break*/, 5];
                        case 3:
                            error_4 = _b.sent();
                            btn.textContent = '✗ Failed';
                            setTimeout(function () {
                                btn.textContent = originalText;
                            }, 2000);
                            console.error('Failed to refresh rates:', error_4);
                            return [3 /*break*/, 5];
                        case 4:
                            btn.disabled = false;
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
        });
        // Refresh all rates button
        var refreshAllBtn = this.container.querySelector('#refresh-all-rates-btn');
        if (refreshAllBtn) {
            refreshAllBtn.addEventListener('click', function () { return __awaiter(_this, void 0, void 0, function () {
                var allCurrencies, originalText, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            allCurrencies = this.getAllCurrencies();
                            if (allCurrencies.length === 0)
                                return [2 /*return*/];
                            originalText = refreshAllBtn.textContent;
                            refreshAllBtn.textContent = '⏳ Refreshing...';
                            refreshAllBtn.disabled = true;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, 4, 5]);
                            return [4 /*yield*/, this.refreshExchangeRates()];
                        case 2:
                            _a.sent();
                            // Highlight all exchange rate displays
                            this.container.querySelectorAll('.exchange-rate-info').forEach(function (rateInfo) {
                                var el = rateInfo;
                                el.style.transition = 'background-color 0.3s ease';
                                el.style.backgroundColor = '#d4edda';
                                el.style.padding = '4px 6px';
                                el.style.borderRadius = '3px';
                                // Remove highlight after 2 seconds
                                setTimeout(function () {
                                    el.style.backgroundColor = '';
                                    el.style.padding = '';
                                    el.style.borderRadius = '';
                                }, 2000);
                            });
                            // Update all exchange rate displays without full re-render
                            this.updateExchangeRateDisplays();
                            // Show success message in button briefly
                            refreshAllBtn.textContent = '✓ Refreshed';
                            setTimeout(function () {
                                refreshAllBtn.textContent = originalText;
                            }, 1500);
                            return [3 /*break*/, 5];
                        case 3:
                            error_5 = _a.sent();
                            refreshAllBtn.textContent = '✗ Failed';
                            setTimeout(function () {
                                refreshAllBtn.textContent = originalText;
                            }, 2000);
                            console.error('Failed to refresh rates:', error_5);
                            return [3 /*break*/, 5];
                        case 4:
                            refreshAllBtn.disabled = false;
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
        }
        // Generate costs button for countries without costs
        this.container.querySelectorAll('.generate-costs-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { return __awaiter(_this, void 0, void 0, function () {
                var country, destinationIds, destinations, destNames, confirmed, originalBtn, originalText, costsSection, progressDiv, generatedCosts, progressDiv, error_6, progressDiv;
                var _a;
                var _this = this;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            country = btn.dataset.country;
                            destinationIds = ((_b = btn.dataset.destinations) === null || _b === void 0 ? void 0 : _b.split(',')) || [];
                            destinations = destinationIds
                                .map(function (id) { return (_this.tripData.locations || []).find(function (loc) { return String(loc.id) === id; }); })
                                .filter(function (d) { return d; });
                            destNames = destinations.map(function (d) { return d.name || d.city; }).join(', ');
                            confirmed = confirm("Generate AI cost estimates for ".concat(destNames, "?\n\n") +
                                "The AI will research and estimate costs for accommodation, activities, food, and transport.\n\n" +
                                "This may take 30-60 seconds. Continue?");
                            if (!confirmed)
                                return [2 /*return*/];
                            originalBtn = btn;
                            originalText = originalBtn.innerHTML;
                            originalBtn.disabled = true;
                            originalBtn.innerHTML = '⏳ Generating costs...';
                            costsSection = this.container.querySelector(".item-costs-section[data-country=\"".concat(country, "\"]"));
                            if (costsSection) {
                                progressDiv = document.createElement('div');
                                progressDiv.className = 'cost-generation-progress';
                                progressDiv.innerHTML = "\n            <div style=\"padding: 20px; text-align: center; background: #f0f8ff; border-radius: 6px; margin: 15px 0;\">\n              <div style=\"font-size: 16px; font-weight: 600; color: #1a73e8; margin-bottom: 8px;\">\n                \uD83E\uDD16 AI is generating cost estimates...\n              </div>\n              <div style=\"font-size: 14px; color: #666; margin-bottom: 12px;\">\n                Researching ".concat(destNames, "\n              </div>\n              <div style=\"width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;\">\n                <div style=\"width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2, #667eea); background-size: 200% 100%; animation: shimmer 1.5s infinite;\"></div>\n              </div>\n            </div>\n            <style>\n              @keyframes shimmer {\n                0% { background-position: -200% 0; }\n                100% { background-position: 200% 0; }\n              }\n            </style>\n          ");
                                costsSection.insertBefore(progressDiv, costsSection.firstChild);
                            }
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, this.generateCostsForCountry(country, destinationIds)];
                        case 2:
                            generatedCosts = _c.sent();
                            if (generatedCosts.length === 0) {
                                throw new Error('No costs were generated');
                            }
                            // Add generated costs to tripData
                            if (!this.tripData.costs) {
                                this.tripData.costs = [];
                            }
                            (_a = this.tripData.costs).push.apply(_a, generatedCosts);
                            if (!this.onCostsUpdate) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.onCostsUpdate(generatedCosts)];
                        case 3:
                            _c.sent();
                            _c.label = 4;
                        case 4:
                            // Show success message
                            originalBtn.innerHTML = "\u2713 Generated ".concat(generatedCosts.length, " costs");
                            originalBtn.style.background = '#28a745';
                            // Remove progress UI and refresh display
                            if (costsSection) {
                                progressDiv = costsSection.querySelector('.cost-generation-progress');
                                if (progressDiv) {
                                    progressDiv.remove();
                                }
                            }
                            // Refresh the entire budget manager to show new costs
                            this.render();
                            // Automatically open the costs section for this country
                            setTimeout(function () {
                                var updatedCostsSection = _this.container.querySelector(".item-costs-section[data-country=\"".concat(country, "\"]"));
                                if (updatedCostsSection) {
                                    updatedCostsSection.style.display = 'block';
                                }
                                // Update the toggle button text
                                var toggleBtn = _this.container.querySelector(".costs-toggle-btn[data-country=\"".concat(country, "\"]"));
                                if (toggleBtn) {
                                    var countryCurrentCosts = (_this.tripData.costs || []).filter(function (c) {
                                        var location = (_this.tripData.locations || []).find(function (loc) { return loc.id === c.destination_id; });
                                        return (location === null || location === void 0 ? void 0 : location.country) === country;
                                    });
                                    toggleBtn.innerHTML = "\uD83D\uDCB0 \u25BC Hide Costs (".concat(countryCurrentCosts.length, ")");
                                }
                                // Auto-resize textareas in the opened section
                                _this.setupAutoResizeTextareas();
                            }, 100);
                            // Reset button after 3 seconds
                            setTimeout(function () {
                                originalBtn.innerHTML = originalText;
                                originalBtn.style.background = '';
                                originalBtn.disabled = false;
                            }, 3000);
                            return [3 /*break*/, 6];
                        case 5:
                            error_6 = _c.sent();
                            console.error('Failed to generate costs:', error_6);
                            // Remove progress UI
                            if (costsSection) {
                                progressDiv = costsSection.querySelector('.cost-generation-progress');
                                if (progressDiv) {
                                    progressDiv.remove();
                                }
                            }
                            // Show error
                            originalBtn.innerHTML = '✗ Generation failed';
                            originalBtn.style.background = '#dc3545';
                            alert("Failed to generate costs: ".concat(error_6 instanceof Error ? error_6.message : 'Unknown error'));
                            // Reset button after 3 seconds
                            setTimeout(function () {
                                originalBtn.innerHTML = originalText;
                                originalBtn.style.background = '';
                                originalBtn.disabled = false;
                            }, 3000);
                            return [3 /*break*/, 6];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
        });
    };
    BudgetManager.prototype.setupAutoResizeTextareas = function () {
        // Function to auto-resize a textarea based on its content
        var autoResize = function (textarea) {
            // Reset height to get accurate scrollHeight
            textarea.style.height = 'auto';
            // Set height to scrollHeight to fit content
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        // Setup auto-resize for all textareas with the auto-resize class
        this.container.querySelectorAll('textarea.auto-resize').forEach(function (textarea) {
            var el = textarea;
            // Initial resize - use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(function () {
                autoResize(el);
            });
            // Resize on input
            el.addEventListener('input', function () { return autoResize(el); });
            // Resize on focus (in case content was changed programmatically)
            el.addEventListener('focus', function () { return autoResize(el); });
        });
    };
    BudgetManager.prototype.render = function () {
        var html = this.renderBudgetStatus();
        this.container.innerHTML = html;
        this.container.style.display = 'block';
        this.attachEventListeners();
    };
    return BudgetManager;
}());
exports.BudgetManager = BudgetManager;
// CSS styles for the budget manager
exports.budgetManagerStyles = "\n<style>\n.budget-manager {\n  background: white;\n  border-radius: 8px;\n  padding: 20px;\n  box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n  margin: 20px 0;\n}\n\n.budget-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 20px;\n}\n\n.budget-header h3 {\n  margin: 0;\n  font-size: 20px;\n}\n\n.budget-subtitle {\n  color: #666;\n  margin: 5px 0 0 0;\n}\n\n/* Compact header styles */\n.budget-header-compact {\n  padding: 15px;\n  background: #f8f9fa;\n  border-radius: 8px;\n  margin-bottom: 20px;\n}\n\n.header-row {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 12px;\n}\n\n.header-row h3 {\n  margin: 0;\n  font-size: 18px;\n}\n\n.header-actions {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n}\n\n.btn-primary-sm {\n  padding: 6px 16px;\n  background: #007bff;\n  color: white;\n  border: none;\n  border-radius: 4px;\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background 0.2s;\n}\n\n.btn-primary-sm:hover {\n  background: #0056b3;\n}\n\n.btn-secondary-sm {\n  padding: 6px 16px;\n  background: #6c757d;\n  color: white;\n  border: none;\n  border-radius: 4px;\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background 0.2s;\n}\n\n.btn-secondary-sm:hover {\n  background: #5a6268;\n}\n\n.btn-secondary-sm:disabled,\n.btn-primary-sm:disabled {\n  opacity: 0.6;\n  cursor: not-allowed;\n}\n\n.rates-fetch-date {\n  font-size: 11px;\n  color: #666;\n  font-style: italic;\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.auto-save-indicator {\n  font-size: 12px;\n  font-weight: 600;\n  margin-left: 12px;\n  padding: 4px 8px;\n  border-radius: 4px;\n  transition: all 0.3s ease;\n}\n\n.auto-save-indicator.saving {\n  color: #0056b3;\n  background: #cfe2ff;\n}\n\n.auto-save-indicator.saved {\n  color: #155724;\n  background: #d4edda;\n}\n\n.auto-save-indicator.error {\n  color: #721c24;\n  background: #f8d7da;\n}\n\n.budget-overview-compact {\n  display: flex;\n  gap: 15px;\n  align-items: center;\n  flex-wrap: wrap;\n  margin-bottom: 10px;\n}\n\n.budget-field {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.budget-field label {\n  font-size: 13px;\n  font-weight: 600;\n  color: #555;\n}\n\n.budget-field input {\n  width: 90px;\n  padding: 4px 8px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  font-size: 14px;\n}\n\n.budget-field span {\n  font-size: 12px;\n  color: #666;\n}\n\n.budget-stat {\n  display: flex;\n  align-items: baseline;\n  gap: 6px;\n}\n\n.stat-label {\n  font-size: 12px;\n  color: #666;\n  font-weight: 500;\n}\n\n.stat-value {\n  font-size: 15px;\n  font-weight: 700;\n  color: #333;\n}\n\n.stat-value.positive {\n  color: #28a745;\n}\n\n.stat-value.negative {\n  color: #dc3545;\n}\n\n.stat-pct {\n  font-size: 13px;\n  font-weight: 500;\n  color: #666;\n  margin-left: 4px;\n}\n\n.budget-progress-compact {\n  margin-top: 8px;\n}\n\n.budget-progress-compact .progress-bar {\n  height: 6px;\n  border-radius: 3px;\n}\n\n.btn-icon {\n  background: none;\n  border: none;\n  font-size: 18px;\n  cursor: pointer;\n  padding: 5px 10px;\n}\n\n.btn-icon:hover {\n  background: #f0f0f0;\n  border-radius: 4px;\n}\n\n.budget-overview {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 15px;\n  margin-bottom: 20px;\n}\n\n.budget-total, .budget-spent, .budget-remaining {\n  padding: 15px;\n  border-radius: 6px;\n  background: #f8f9fa;\n}\n\n.budget-spent.over-budget {\n  background: #fee;\n}\n\n.budget-spent.warning {\n  background: #fff3cd;\n}\n\n.budget-label {\n  font-size: 12px;\n  color: #666;\n  text-transform: uppercase;\n  margin-bottom: 5px;\n}\n\n.budget-amount {\n  font-size: 24px;\n  font-weight: bold;\n}\n\n.budget-amount.negative {\n  color: #dc3545;\n}\n\n.budget-progress {\n  margin: 20px 0;\n}\n\n.progress-bar {\n  height: 30px;\n  background: #e9ecef;\n  border-radius: 15px;\n  overflow: hidden;\n  position: relative;\n}\n\n.progress-fill {\n  height: 100%;\n  background: #28a745;\n  transition: width 0.3s ease;\n}\n\n.progress-bar.caution .progress-fill {\n  background: #ffc107;\n}\n\n.progress-bar.warning .progress-fill {\n  background: #fd7e14;\n}\n\n.progress-bar.over-budget .progress-fill {\n  background: #dc3545;\n}\n\n.progress-label {\n  text-align: center;\n  margin-top: 5px;\n  font-weight: bold;\n}\n\n.budget-alerts {\n  margin: 20px 0;\n  padding: 15px;\n  background: #f8f9fa;\n  border-radius: 6px;\n}\n\n.budget-alerts h4 {\n  margin: 0 0 10px 0;\n  font-size: 16px;\n}\n\n.budget-alert {\n  padding: 10px;\n  margin: 5px 0;\n  border-radius: 4px;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.alert-info {\n  background: #d1ecf1;\n  border-left: 4px solid #0c5460;\n}\n\n.alert-warning {\n  background: #fff3cd;\n  border-left: 4px solid #856404;\n}\n\n.alert-exceeded {\n  background: #f8d7da;\n  border-left: 4px solid #721c24;\n}\n\n.budget-breakdown {\n  margin: 20px 0;\n}\n\n.budget-breakdown h4 {\n  margin: 0 0 15px 0;\n  font-size: 16px;\n}\n\n.budget-items {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.budget-item {\n  padding: 10px;\n  background: #f8f9fa;\n  border-radius: 4px;\n}\n\n.item-header {\n  display: flex;\n  justify-content: space-between;\n  margin-bottom: 5px;\n}\n\n.item-name {\n  font-weight: 500;\n  text-transform: capitalize;\n}\n\n.item-amounts {\n  font-size: 14px;\n  color: #666;\n}\n\n.item-progress {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.mini-progress-bar {\n  flex: 1;\n  height: 8px;\n  background: #e9ecef;\n  border-radius: 4px;\n  overflow: hidden;\n}\n\n.mini-progress-fill {\n  height: 100%;\n  background: #28a745;\n  transition: width 0.3s ease;\n}\n\n.mini-progress-bar.warning .mini-progress-fill {\n  background: #fd7e14;\n}\n\n.mini-progress-bar.over-budget .mini-progress-fill {\n  background: #dc3545;\n}\n\n.item-percentage {\n  font-size: 12px;\n  color: #666;\n  min-width: 40px;\n  text-align: right;\n}\n\n.budget-actions {\n  display: flex;\n  gap: 10px;\n  margin: 20px 0;\n}\n\n.btn-primary, .btn-secondary {\n  padding: 10px 20px;\n  border-radius: 6px;\n  border: none;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 500;\n}\n\n.btn-primary {\n  background: #007bff;\n  color: white;\n}\n\n.btn-primary:hover {\n  background: #0056b3;\n}\n\n.btn-secondary {\n  background: #6c757d;\n  color: white;\n}\n\n.btn-secondary:hover {\n  background: #545b62;\n}\n\n.budget-help {\n  margin-top: 20px;\n  padding: 15px;\n  background: #e7f3ff;\n  border-left: 4px solid #007bff;\n  border-radius: 4px;\n}\n\n.budget-help p {\n  margin: 0;\n  font-size: 14px;\n}\n\n.current-spending {\n  margin: 20px 0;\n}\n\n.spending-summary {\n  padding: 20px;\n  background: #f8f9fa;\n  border-radius: 6px;\n  text-align: center;\n}\n\n.spending-label {\n  font-size: 14px;\n  color: #666;\n  margin-bottom: 10px;\n}\n\n.spending-amount {\n  font-size: 32px;\n  font-weight: bold;\n  color: #007bff;\n}\n\n/* Integrated budget interface styles */\n.budget-manager.integrated {\n  max-width: 100%;\n}\n\n.header-actions {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n}\n\n.budget-edit-section {\n  background: #f8f9fa;\n  border-radius: 8px;\n  padding: 20px;\n  margin: 20px 0;\n  border: 1px solid #e0e0e0;\n}\n\n.budget-edit-section h4 {\n  margin: 0 0 15px 0;\n  font-size: 16px;\n  color: #333;\n}\n\n.section-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-bottom: 15px;\n}\n\n.section-header h4 {\n  margin: 0;\n}\n\n.mode-controls {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n\n.mode-indicator {\n  font-size: 13px;\n  color: #666;\n  font-weight: 500;\n}\n\n.budget-overview-edit {\n  display: flex;\n  gap: 20px;\n  flex-wrap: wrap;\n  margin-bottom: 20px;\n}\n\n.form-group-inline {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  flex: 1;\n  min-width: 200px;\n}\n\n.form-group-inline label {\n  font-size: 13px;\n  font-weight: 600;\n  color: #333;\n}\n\n.budget-status-display {\n  display: flex;\n  gap: 20px;\n  padding: 15px;\n  background: white;\n  border-radius: 6px;\n  margin: 15px 0;\n  flex-wrap: wrap;\n}\n\n.status-item {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n\n.status-label {\n  font-size: 12px;\n  color: #666;\n  text-transform: uppercase;\n}\n\n.status-value {\n  font-size: 18px;\n  font-weight: bold;\n}\n\n.status-value.positive {\n  color: #28a745;\n}\n\n.status-value.negative {\n  color: #dc3545;\n}\n\n.status-value.over-budget,\n.status-value.warning {\n  color: #dc3545;\n}\n\n.allocation-status {\n  padding: 12px;\n  background: white;\n  border-radius: 6px;\n  margin: 15px 0;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}\n\n.allocation-info {\n  font-size: 14px;\n}\n\n.allocation-remainder {\n  font-weight: 600;\n  font-size: 14px;\n}\n\n.budget-summary-box {\n  padding: 15px;\n  background: white;\n  border-radius: 6px;\n  margin: 15px 0;\n  border: 1px solid #e0e0e0;\n  box-shadow: 0 2px 4px rgba(0,0,0,0.05);\n}\n\n.summary-row {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 8px 0;\n  border-bottom: 1px solid #f0f0f0;\n}\n\n.summary-row:last-child {\n  border-bottom: none;\n  padding-bottom: 0;\n}\n\n.summary-label {\n  font-weight: 600;\n  color: #333;\n  font-size: 14px;\n}\n\n.summary-value {\n  font-weight: 700;\n  color: #333;\n  font-size: 16px;\n  transition: color 0.2s;\n}\n\n.summary-percentage {\n  font-weight: 600;\n  font-size: 14px;\n  margin-left: 10px;\n  transition: color 0.2s;\n}\n\n.budget-items-edit {\n  display: flex;\n  flex-direction: column;\n  gap: 15px;\n}\n\n.budget-item-edit {\n  background: white;\n  padding: 15px;\n  border-radius: 6px;\n  border: 1px solid #e0e0e0;\n}\n\n.item-label {\n  font-weight: 600;\n  margin-bottom: 10px;\n  color: #333;\n}\n\n.item-header-row {\n  margin-bottom: 10px;\n}\n\n.item-label-with-note {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.item-label-text {\n  font-weight: 600;\n  color: #333;\n}\n\n.inline-note {\n  flex: 1;\n  color: #666;\n  font-size: 13px;\n  font-style: italic;\n  padding: 4px 8px;\n  background: #fffbf0;\n  border-radius: 4px;\n  border: 1px solid #ffe4a3;\n  min-width: 200px;\n}\n\n.days-label {\n  font-weight: normal;\n  color: #666;\n  font-size: 13px;\n}\n\n.item-input-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  flex-wrap: wrap;\n}\n\n.item-status {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  flex: 1;\n  min-width: 300px;\n}\n\n.item-status .mini-progress-bar {\n  flex: 1;\n  min-width: 100px;\n}\n\n.budget-footer {\n  margin-top: 30px;\n  padding-top: 20px;\n  border-top: 2px solid #e0e0e0;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.input-with-unit {\n  position: relative;\n  display: flex;\n  align-items: center;\n  flex: 0 0 180px;\n  gap: 8px;\n}\n\n.input-with-unit input {\n  width: 120px;\n  padding: 8px 12px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  font-size: 14px;\n}\n\n.input-with-unit input:focus {\n  outline: none;\n  border-color: #007bff;\n  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);\n}\n\n.input-unit {\n  font-size: 12px;\n  font-weight: 600;\n  color: #666;\n  min-width: 35px;\n  text-align: left;\n}\n\n.calc-arrow {\n  font-size: 16px;\n  color: #999;\n  flex-shrink: 0;\n}\n\n.calculated-display {\n  min-width: 80px;\n  padding: 8px 12px;\n  background: #f8f9fa;\n  border-radius: 4px;\n  font-size: 14px;\n  font-weight: 500;\n  color: #007bff;\n}\n\n.calc-value {\n  white-space: nowrap;\n}\n\n.current-spend {\n  font-size: 12px;\n  color: #666;\n  white-space: nowrap;\n}\n\n/* Toggle Switch */\n.toggle-switch {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  cursor: pointer;\n  user-select: none;\n}\n\n.toggle-switch input[type=\"checkbox\"] {\n  position: absolute;\n  opacity: 0;\n  width: 0;\n  height: 0;\n}\n\n.toggle-slider {\n  position: relative;\n  display: inline-block;\n  width: 44px;\n  height: 24px;\n  background-color: #ccc;\n  border-radius: 24px;\n  transition: background-color 0.3s;\n}\n\n.toggle-slider::before {\n  content: \"\";\n  position: absolute;\n  height: 18px;\n  width: 18px;\n  left: 3px;\n  bottom: 3px;\n  background-color: white;\n  border-radius: 50%;\n  transition: transform 0.3s;\n}\n\n.toggle-switch input:checked + .toggle-slider {\n  background-color: #007bff;\n}\n\n.toggle-switch input:checked + .toggle-slider::before {\n  transform: translateX(20px);\n}\n\n.toggle-label {\n  font-size: 14px;\n  font-weight: 500;\n  color: #666;\n}\n\n/* Allocation status colors */\n#allocation-status,\n#country-allocation-status {\n  border-left: 4px solid #007bff;\n}\n\n/* Country mode selector buttons */\n.country-mode-selector {\n  display: flex;\n  gap: 4px;\n  background: #f0f0f0;\n  padding: 4px;\n  border-radius: 6px;\n}\n\n.mode-btn {\n  padding: 6px 12px;\n  border: none;\n  background: transparent;\n  color: #666;\n  font-weight: 600;\n  font-size: 13px;\n  cursor: pointer;\n  border-radius: 4px;\n  transition: all 0.2s;\n}\n\n.mode-btn:hover {\n  background: #e0e0e0;\n}\n\n.mode-btn.active {\n  background: #007bff;\n  color: white;\n}\n\n/* Notes sections */\n.group-note-section {\n  margin: 15px 0;\n  padding: 12px;\n  background: #fffbf0;\n  border-radius: 6px;\n  border: 1px solid #ffe4a3;\n}\n\n.note-label {\n  display: block;\n  font-weight: 600;\n  font-size: 13px;\n  color: #333;\n  margin-bottom: 6px;\n}\n\n.group-note-input {\n  width: 100%;\n  padding: 8px 12px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  font-size: 13px;\n  font-family: inherit;\n  resize: vertical;\n  box-sizing: border-box;\n}\n\n.group-note-input:focus {\n  outline: none;\n  border-color: #007bff;\n  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);\n}\n\n.note-toggle-btn {\n  background: none;\n  border: none;\n  padding: 4px 8px;\n  font-size: 16px;\n  cursor: pointer;\n  opacity: 0.6;\n  transition: opacity 0.2s;\n  margin-left: 8px;\n}\n\n.note-toggle-btn:hover {\n  opacity: 1;\n}\n\n.item-note-section {\n  margin-top: 10px;\n  padding: 10px;\n  background: #fffbf0;\n  border-radius: 4px;\n  border: 1px solid #ffe4a3;\n}\n\n.item-note-input {\n  width: 100%;\n  padding: 6px 10px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  font-size: 12px;\n  font-family: inherit;\n  resize: vertical;\n}\n\n.item-note-input:focus {\n  outline: none;\n  border-color: #007bff;\n  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);\n}\n\n/* Category breakdown visualization */\n.est-cost-with-breakdown {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.cat-breakdown-bar {\n  display: flex;\n  height: 8px;\n  gap: 1px;\n  border-radius: 4px;\n  overflow: hidden;\n}\n\n.cat-breakdown-item {\n  flex: 1;\n  min-width: 3px;\n  transition: transform 0.2s;\n}\n\n.cat-breakdown-item:hover {\n  transform: scaleY(1.5);\n  cursor: help;\n}\n\n/* Costs toggle button */\n.costs-toggle-btn {\n  background: #007bff;\n  color: white;\n  border: none;\n  padding: 6px 12px;\n  font-size: 13px;\n  cursor: pointer;\n  border-radius: 4px;\n  transition: background 0.2s;\n  margin-left: 8px;\n  font-weight: 500;\n}\n\n.costs-toggle-btn:hover {\n  background: #0056b3;\n}\n\n/* Costs section */\n.item-costs-section {\n  margin-top: 15px;\n  padding: 15px;\n  background: #f8f9fa;\n  border-radius: 6px;\n  border: 1px solid #e0e0e0;\n}\n\n.country-costs-table {\n  background: white;\n  border-radius: 6px;\n  padding: 12px;\n}\n\n.destination-costs-section {\n  margin-bottom: 20px;\n}\n\n.destination-costs-section:last-child {\n  margin-bottom: 0;\n}\n\n.destination-header {\n  font-weight: 600;\n  font-size: 14px;\n  color: #333;\n  margin-bottom: 10px;\n  padding: 8px 12px;\n  background: #f0f7ff;\n  border-left: 4px solid #007bff;\n  border-radius: 4px;\n}\n\n.costs-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 13px;\n  margin-bottom: 12px;\n}\n\n.costs-table thead {\n  background: #f8f9fa;\n  border-bottom: 2px solid #dee2e6;\n}\n\n.costs-table th {\n  padding: 10px 12px;\n  text-align: left;\n  font-weight: 600;\n  color: #495057;\n  font-size: 12px;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n}\n\n.costs-table th.text-right {\n  text-align: right;\n}\n\n.costs-table tbody tr {\n  border-bottom: 1px solid #f0f0f0;\n  transition: background 0.2s;\n}\n\n.costs-table tbody tr:hover {\n  background: #f8f9fa;\n}\n\n.costs-table td {\n  padding: 10px 12px;\n  color: #333;\n}\n\n.costs-table td.text-right {\n  text-align: right;\n}\n\n.costs-table td.amount-cell {\n  font-weight: 600;\n  color: #007bff;\n  white-space: nowrap;\n}\n\n.costs-table td.notes-cell {\n  color: #666;\n  font-size: 12px;\n  word-wrap: break-word;\n  max-width: 400px;\n}\n\n.category-badge {\n  display: inline-block;\n  padding: 4px 10px;\n  border-radius: 4px;\n  color: white;\n  font-size: 12px;\n  font-weight: 500;\n  white-space: nowrap;\n}\n\n.status-badge {\n  display: inline-block;\n  padding: 4px 8px;\n  border-radius: 3px;\n  font-size: 11px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.3px;\n}\n\n.status-estimated {\n  background: #fff3cd;\n  color: #856404;\n}\n\n.status-researched {\n  background: #d1ecf1;\n  color: #0c5460;\n}\n\n.status-booked {\n  background: #d4edda;\n  color: #155724;\n}\n\n.status-paid {\n  background: #c3e6cb;\n  color: #155724;\n}\n\n.costs-table tfoot .total-row {\n  background: #f8f9fa;\n  border-top: 2px solid #dee2e6;\n  font-weight: 600;\n}\n\n.costs-table tfoot .total-row td {\n  padding: 12px;\n}\n\n.country-total-row {\n  display: flex;\n  justify-content: space-between;\n  padding: 12px 16px;\n  background: #e7f3ff;\n  border-radius: 6px;\n  font-size: 14px;\n  font-weight: 600;\n  color: #007bff;\n  margin-top: 12px;\n  border: 1px solid #b8daff;\n}\n\n.no-costs-container {\n  background: white;\n  border-radius: 6px;\n  border: 1px solid #e0e0e0;\n}\n\n.no-costs-message {\n  padding: 24px;\n  text-align: center;\n  color: #666;\n  border-bottom: 1px solid #f0f0f0;\n}\n\n.generate-costs-btn {\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  color: white;\n  border: none;\n  padding: 12px 24px;\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  border-radius: 6px;\n  transition: all 0.2s;\n  box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n}\n\n.generate-costs-btn:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 4px 8px rgba(0,0,0,0.15);\n}\n\n.generate-costs-btn:active {\n  transform: translateY(0);\n}\n\n/* Editable costs table styles */\n.costs-table-actions {\n  display: flex;\n  gap: 10px;\n  align-items: center;\n  margin-bottom: 12px;\n  padding: 10px;\n  background: white;\n  border-radius: 6px;\n  border: 1px solid #e0e0e0;\n}\n\n.btn-sm {\n  padding: 6px 12px;\n  font-size: 13px;\n  border-radius: 4px;\n  border: none;\n  cursor: pointer;\n  font-weight: 500;\n  transition: background 0.2s;\n}\n\n.btn-success {\n  background: #28a745;\n  color: white;\n}\n\n.btn-success:hover {\n  background: #218838;\n}\n\n.unsaved-indicator {\n  color: #dc3545;\n  font-size: 13px;\n  font-weight: 600;\n  margin-left: auto;\n}\n\n.editable-costs-table {\n  table-layout: fixed;\n}\n\n.cost-field-input,\n.cost-field-select {\n  width: 100%;\n  padding: 6px 8px;\n  border: 1px solid #ddd;\n  border-radius: 3px;\n  font-size: 12px;\n  font-family: inherit;\n}\n\n.cost-field-input:focus,\n.cost-field-select:focus {\n  outline: none;\n  border-color: #007bff;\n  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);\n}\n\n.cost-field-input:disabled {\n  background: #f8f9fa;\n  color: #999;\n}\n\ntextarea.cost-field-input {\n  resize: none;\n  overflow: hidden;\n  min-height: 34px;\n  line-height: 1.4;\n}\n\ntextarea.auto-resize {\n  resize: none;\n  overflow: hidden;\n}\n\n.btn-icon {\n  background: none;\n  border: none;\n  font-size: 16px;\n  cursor: pointer;\n  padding: 4px;\n  opacity: 0.6;\n  transition: opacity 0.2s;\n}\n\n.btn-icon:hover {\n  opacity: 1;\n}\n\n/* Add cost form */\n.add-cost-section {\n  margin-top: 15px;\n}\n\n.add-cost-form {\n  background: white;\n  padding: 20px;\n  border-radius: 6px;\n  border: 2px solid #28a745;\n}\n\n.add-cost-form h5 {\n  margin: 0 0 15px 0;\n  color: #28a745;\n  font-size: 16px;\n}\n\n.form-row {\n  display: flex;\n  gap: 12px;\n  margin-bottom: 12px;\n  align-items: flex-start;\n}\n\n.form-group {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n}\n\n.form-group label {\n  font-size: 12px;\n  font-weight: 600;\n  margin-bottom: 4px;\n  color: #333;\n}\n\n.new-cost-field {\n  padding: 8px 10px;\n  border: 1px solid #ddd;\n  border-radius: 4px;\n  font-size: 13px;\n  font-family: inherit;\n}\n\n.new-cost-field:focus {\n  outline: none;\n  border-color: #28a745;\n  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);\n}\n\n.new-cost-field:disabled {\n  background: #f8f9fa;\n  color: #999;\n}\n\n.form-actions {\n  display: flex;\n  gap: 10px;\n  margin-top: 15px;\n  padding-top: 15px;\n  border-top: 1px solid #e0e0e0;\n}\n\n/* Currency input with symbol */\n.currency-input-wrapper {\n  position: relative;\n  display: flex;\n  align-items: center;\n}\n\n.currency-symbol {\n  position: absolute;\n  left: 8px;\n  font-weight: 600;\n  color: #666;\n  pointer-events: none;\n  z-index: 1;\n  font-size: 14px;\n}\n\n.currency-input-wrapper .cost-field-input {\n  padding-left: 36px;\n  text-align: right;\n}\n\n.currency-display-wrapper {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.currency-code-display {\n  font-weight: 600;\n  font-size: 14px;\n  color: #333;\n  padding: 4px 0;\n}\n\n.exchange-rate-info {\n  font-size: 10px;\n  color: #666;\n  font-style: italic;\n  white-space: nowrap;\n  line-height: 1.3;\n}\n\n.rate-date {\n  font-size: 9px;\n  color: #999;\n}\n</style>\n";
