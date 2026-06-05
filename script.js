
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
 
const SEGMENTS = ['Online TA', 'Offline TA/TO', 'Direct', 'Groups', 'Corporate', 'Complementary', 'Aviation', 'Undefined'];
const SEG_COLORS = ['#4b8fe8', '#e8b84b', '#4be8b8', '#e84b8f', '#b84be8', '#e8784b', '#4be8e8', '#888'];
 
const COLORS = {
  primary: '#4b8fe8',
  accent: '#e8b84b',
  success: '#4be8b8',
  danger: '#e84b6a',
  grid: 'rgba(255, 255, 255, 0.05)',
};
 
// STATE MANAGEMENT
const state = {
  hotel: 'all',
  year: 'all',
  country: 'all',
  sortCountry: 'bookings',
  animPlaying: false,
  animYear: 2015,
  animTimer: null,
  // CROSS-FILTER: aktivni cross-filter odabiri
  activeMonth: null,
  activeSegment: null
};
 
let RAW_DATA = [];
let TOP_COUNTRIES = [];
const tooltip = d3.select('#tooltip');
 
// INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
  setupFilters();
  buildAllCharts();
  loadCSV();
});
 
// LOADING OVERLAY
function showLoading() {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = `
      position: fixed; inset: 0; background: rgba(15,15,30,0.85);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 9999; color: #e0e0e0; font-size: 1.1em; gap: 16px;
    `;
    el.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid rgba(75,143,232,0.2);
        border-top-color:#4b8fe8;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <span>Učitavanje podataka...</span>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  }
}
 
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.remove();
}
 
// CSV LOADER - učitava stvarni hotel_bookings.csv
async function loadCSV() {
  showLoading();
  try {
    const response = await fetch('hotel_bookings.csv');
    const text = await response.text();
    parseCSV(text);
  } catch (e) {
    console.warn('CSV nije pronađen, koristim simulirane podatke:', e);
    generateSampleData();
  }
  hideLoading();
}
 
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
 
  const TOP_N = 10;
  const countryCounts = {};
 
  // Prvo prolazimo da nađemo top 10 zemalja
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const country = vals[headers.indexOf('country')] || 'Unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }
 
  TOP_COUNTRIES = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([c]) => c);
 
  RAW_DATA = [];
  const monthIdx = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
 
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 10) continue;
 
    const get = col => vals[headers.indexOf(col)] || '';
 
    const hotel = get('hotel');
    const month = get('arrival_date_month');
    const year = get('arrival_date_year');
    const country = get('country');
    const segment = get('market_segment');
    const isCanceled = parseInt(get('is_canceled')) || 0;
    const adr = parseFloat(get('adr')) || 0;
    const weekendNights = parseInt(get('stays_in_weekend_nights')) || 0;
    const weekNights = parseInt(get('stays_in_week_nights')) || 0;
    const stay = weekendNights + weekNights;
 
    if (!month || !year || !hotel) continue;
 
    RAW_DATA.push({
      month: month,
      monthIdx: monthIdx[month] ?? 0,
      year: String(year),
      hotel: hotel,
      country: TOP_COUNTRIES.includes(country) ? country : 'Other',
      segment: segment || 'Undefined',
      bookings: 1,
      canceled: isCanceled,
      adr: adr,
      avg_stay: stay
    });
  }
 
  // Dodaj 'Other' u top countries ako postoji
  const hasOther = RAW_DATA.some(d => d.country === 'Other');
  if (hasOther) TOP_COUNTRIES.push('Other');
 
  populateCountryFilter();
  updateAll();
}
 
// Parsira jedan CSV red, uzima u obzir navodnike
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
 
// FALLBACK: simulirani podaci ako CSV nije dostupan
function generateSampleData() {
  const hotels = ['City Hotel', 'Resort Hotel'];
  const countries = ['PRT', 'GBR', 'FRA', 'ESP', 'DEU', 'ITA', 'IRL', 'USA', 'NLD', 'BEL'];
 
  RAW_DATA = [];
 
  MONTHS.forEach((month, monthIdx) => {
    for (let year = 2015; year <= 2017; year++) {
      hotels.forEach(hotel => {
        countries.forEach(country => {
          SEGMENTS.forEach(segment => {
            const base = Math.random() * 500 + 200;
            const seasonalFactor = 0.8 + 0.6 * Math.sin((monthIdx / 12) * Math.PI * 2);
            const bookings = Math.floor(base * seasonalFactor);
            const canceled = Math.floor(bookings * (0.05 + Math.random() * 0.2));
            const adr = 50 + Math.random() * 150;
            const stay = 2 + Math.random() * 5;
 
            RAW_DATA.push({
              month: month,
              monthIdx: monthIdx,
              year: String(year),
              hotel: hotel,
              country: country,
              segment: segment,
              bookings: bookings,
              canceled: canceled,
              adr: Math.round(adr * 100) / 100,
              avg_stay: Math.round(stay * 100) / 100
            });
          });
        });
      });
    }
  });
 
  TOP_COUNTRIES = countries;
  populateCountryFilter();
  updateAll();
}
 
// FILTERS SETUP
function populateCountryFilter() {
  const select = document.getElementById('country-filter');
  TOP_COUNTRIES.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });
}
 
function setupFilters() {
  document.querySelectorAll('#hotel-filter .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#hotel-filter .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.hotel = btn.dataset.value;
      updateAll();
    });
  });
  
  document.querySelectorAll('#year-filter .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#year-filter .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.year = btn.dataset.value;
      stopAnimation();
      updateAll();
    });
  });
  
  document.getElementById('country-filter').addEventListener('change', (e) => {
    state.country = e.target.value;
    updateAll();
  });
  
  document.getElementById('sort-country').addEventListener('change', (e) => {
    state.sortCountry = e.target.value;
    updateCountriesChart();
  });
  
  document.getElementById('play-btn').addEventListener('click', toggleAnimation);
  
  document.addEventListener('mousemove', (e) => {
    if (tooltip.classed('visible')) {
      moveTooltip(e);
    }
  });
}
 
// DATA FILTERING
function filtered() {
  return RAW_DATA.filter(d => {
    if (state.hotel !== 'all' && d.hotel !== state.hotel) return false;
    if (state.year !== 'all' && d.year !== state.year) return false;
    if (state.country !== 'all' && d.country !== state.country) return false;
    // CROSS-FILTER: dodatni filteri iz cross-filter odabira
    if (state.activeMonth !== null && d.month !== state.activeMonth) return false;
    if (state.activeSegment !== null && d.segment !== state.activeSegment) return false;
    return true;
  });
}
 
// CROSS-FILTER: Helper za postavljanje i uklanjanje cross-filtera
function setCrossFilter(type, value) {
  if (type === 'month') {
    // Toggle - klik na isti bar gasi filter
    state.activeMonth = state.activeMonth === value ? null : value;
  } else if (type === 'segment') {
    state.activeSegment = state.activeSegment === value ? null : value;
  }
  updateAll();
}
 
// CROSS-FILTER: Prikazuje aktivne cross-filtere ispod kontrola
function renderCrossFilterBadges() {
  let container = document.getElementById('crossfilter-badges');
  if (!container) {
    container = document.createElement('div');
    container.id = 'crossfilter-badges';
    container.style.cssText = `
      display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;
      min-height: 28px;
    `;
    document.querySelector('.controls-container').appendChild(container);
  }
  container.innerHTML = '';
 
  const badges = [];
  if (state.activeMonth) badges.push({ label: `Month: ${state.activeMonth}`, type: 'month' });
  if (state.activeSegment) badges.push({ label: `Segment: ${state.activeSegment}`, type: 'segment' });
 
  badges.forEach(b => {
    const badge = document.createElement('span');
    badge.style.cssText = `
      background: rgba(232,184,75,0.2); border: 1px solid #e8b84b;
      color: #e8b84b; border-radius: 20px; padding: 3px 12px;
      font-size: 0.8em; cursor: pointer; display: flex; align-items: center; gap: 6px;
      transition: background 0.2s;
    `;
    badge.innerHTML = `${b.label} <strong>✕</strong>`;
    badge.title = 'Klikni za uklanjanje filtera';
    badge.addEventListener('click', () => {
      if (b.type === 'month') state.activeMonth = null;
      if (b.type === 'segment') state.activeSegment = null;
      updateAll();
    });
    container.appendChild(badge);
  });
 
  if (badges.length > 0) {
    const clearAll = document.createElement('span');
    clearAll.style.cssText = `
      background: rgba(232,75,106,0.15); border: 1px solid #e84b6a;
      color: #e84b6a; border-radius: 20px; padding: 3px 12px;
      font-size: 0.8em; cursor: pointer;
    `;
    clearAll.textContent = 'Clear all';
    clearAll.addEventListener('click', () => {
      state.activeMonth = null;
      state.activeSegment = null;
      updateAll();
    });
    container.appendChild(clearAll);
  }
}
 
// UPDATE ALL
function updateAll() {
  renderCrossFilterBadges(); // CROSS-FILTER: osvježi badge-ove
  const data = filtered();
  updateKPIs(data);
  updateMonthlyChart(data);
  updateCancelChart(data);
  updateADRChart(data);
  updateCountriesChart(data);
  updateSegmentChart(data);
}
 
// KPI CARDS
function updateKPIs(data) {
  const total = d3.sum(data, d => d.bookings);
  const canceled = d3.sum(data, d => d.canceled);
  const cancelRate = total > 0 ? ((canceled / total) * 100).toFixed(1) : 0;
  
  const adrData = data.filter(d => d.adr > 0);
  const avgAdr = adrData.length > 0
    ? (d3.sum(adrData, d => d.adr) / adrData.length).toFixed(0)
    : 0;
 
  const stayData = data.filter(d => d.avg_stay > 0);
  const avgStay = stayData.length > 0
    ? (d3.sum(stayData, d => d.avg_stay) / stayData.length).toFixed(1)
    : 0;
  
  animateValue('kpi-bookings', total, v => v.toLocaleString());
  animateValue('kpi-cancel-rate', cancelRate, v => v + '%');
  animateValue('kpi-adr', avgAdr, v => '€' + v);
  animateValue('kpi-stay', avgStay, v => v + ' nights');
}
 
function animateValue(id, value, formatter) {
  const el = document.getElementById(id);
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = formatter(value);
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '1';
  }, 50);
}
 
// CHART 1: MONTHLY BOOKINGS
let monthlyChart = null;
 
function buildMonthlyChart() {
  const container = document.getElementById('chart-monthly');
  const width = container.parentElement.offsetWidth - 40;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  monthlyChart = {
    svg: svg,
    container: container,
    width: width,
    height: height,
    margin: margin,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    x: d3.scaleBand().range([0, innerWidth]).padding(0.15),
    y: d3.scaleLinear().range([innerHeight, 0]),
    g: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  };
  
  const g = monthlyChart.g;
  g.append('g').attr('class', 'grid-lines');
  g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerHeight})`);
  g.append('g').attr('class', 'y-axis');
  g.append('g').attr('class', 'bars');
 
  // CROSS-FILTER: hint tekst ispod grafa
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#7a7f91')
    .attr('font-size', '10px')
    .text('Klikni na stupac za filtriranje ostalih grafova');
}
 
function updateMonthlyChart(data) {
  if (!monthlyChart) buildMonthlyChart();
  
  // Za monthly chart koristimo podatke BEZ activeMonth filtera
  // da prikažemo sve stupce, ali dimmed one koji nisu odabrani
  const baseData = RAW_DATA.filter(d => {
    if (state.hotel !== 'all' && d.hotel !== state.hotel) return false;
    if (state.year !== 'all' && d.year !== state.year) return false;
    if (state.country !== 'all' && d.country !== state.country) return false;
    if (state.activeSegment !== null && d.segment !== state.activeSegment) return false;
    return true;
  });
 
  const aggregated = d3.rollup(baseData, v => v.length, d => d.month);
  const chartData = MONTHS.map(m => ({
    month: m,
    short: m.slice(0, 3),
    bookings: aggregated.get(m) || 0
  }));
  
  monthlyChart.x.domain(chartData.map(d => d.short));
  monthlyChart.y.domain([0, d3.max(chartData, d => d.bookings) * 1.1 || 1]);
  
  monthlyChart.g.select('.grid-lines')
    .call(d3.axisLeft(monthlyChart.y).ticks(5).tickSize(-monthlyChart.innerWidth).tickFormat(''))
    .attr('stroke', COLORS.grid)
    .call(g => g.select('.domain').remove());
  
  monthlyChart.g.select('.x-axis')
    .transition().duration(600)
    .call(d3.axisBottom(monthlyChart.x).tickSize(0))
    .call(g => g.select('.domain').remove());
  
  monthlyChart.g.select('.y-axis')
    .transition().duration(600)
    .call(d3.axisLeft(monthlyChart.y).ticks(5).tickFormat(d3.format(',')))
    .call(g => g.select('.domain').remove());
  
  const bars = monthlyChart.g.select('.bars').selectAll('.bar')
    .data(chartData, d => d.month);
  
  bars.enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => monthlyChart.x(d.short))
    .attr('y', monthlyChart.innerHeight)
    .attr('width', monthlyChart.x.bandwidth())
    .attr('height', 0)
    .attr('rx', 3)
    // CROSS-FILTER: klik na stupac postavlja activeMonth
    .on('click', (event, d) => {
      setCrossFilter('month', d.month);
    })
    .on('mousemove', (event, d) => {
      const hint = state.activeMonth === d.month ? ' (klikni za uklanjanje)' : ' (klikni za filtriranje)';
      showTooltip(event, `${d.month}<br>${d.bookings.toLocaleString()} bookings${hint}`);
    })
    .on('mouseleave', hideTooltip)
    .merge(bars)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', d => monthlyChart.x(d.short))
    .attr('y', d => monthlyChart.y(d.bookings))
    .attr('width', monthlyChart.x.bandwidth())
    .attr('height', d => monthlyChart.innerHeight - monthlyChart.y(d.bookings))
    // CROSS-FILTER: boja i opacity ovise o tome je li bar aktivan/neaktivan
    .attr('fill', (d) => {
      if (state.activeMonth === d.month) return COLORS.accent;
      const max = d3.max(chartData, x => x.bookings);
      return d.bookings === max && !state.activeMonth ? COLORS.accent : COLORS.primary;
    })
    .attr('opacity', d => {
      if (!state.activeMonth) return 1;
      return state.activeMonth === d.month ? 1 : 0.3;
    });
  
  bars.exit().remove();
}
 
// CHART 2: CANCELLATIONS
let cancelChart = null;
 
function buildCancelChart() {
  const container = document.getElementById('chart-cancel');
  const width = container.parentElement.offsetWidth - 40;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  cancelChart = {
    svg: svg,
    container: container,
    width: width,
    height: height,
    margin: margin,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    x: d3.scaleBand().range([0, innerWidth]).padding(0.2),
    y: d3.scaleLinear().range([innerHeight, 0]),
    g: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  };
  
  const g = cancelChart.g;
  g.append('g').attr('class', 'grid-lines');
  g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerHeight})`);
  g.append('g').attr('class', 'y-axis');
  g.append('g').attr('class', 'bars');
}
 
function updateCancelChart(data) {
  if (!cancelChart) buildCancelChart();
  
  const hotelTypes = ['City Hotel', 'Resort Hotel'];
  const aggregated = d3.rollup(data,
    v => ({ bookings: v.length, canceled: d3.sum(v, d => d.canceled) }),
    d => d.hotel
  );
 
  const chartData = hotelTypes.map(h => {
    const agg = aggregated.get(h) || { bookings: 0, canceled: 0 };
    return {
      hotel: h,
      confirmed: agg.bookings - agg.canceled,
      canceled: agg.canceled,
      total: agg.bookings
    };
  });
  
  cancelChart.x.domain(chartData.map(d => d.hotel));
  cancelChart.y.domain([0, d3.max(chartData, d => d.total) * 1.1 || 1]);
  
  cancelChart.g.select('.grid-lines')
    .call(d3.axisLeft(cancelChart.y).ticks(5).tickSize(-cancelChart.innerWidth).tickFormat(''))
    .attr('stroke', COLORS.grid)
    .call(g => g.select('.domain').remove());
  
  cancelChart.g.select('.x-axis')
    .transition().duration(600)
    .call(d3.axisBottom(cancelChart.x).tickSize(0))
    .call(g => g.select('.domain').remove());
  
  cancelChart.g.select('.y-axis')
    .transition().duration(600)
    .call(d3.axisLeft(cancelChart.y).ticks(5).tickFormat(d3.format(',')))
    .call(g => g.select('.domain').remove());
  
  const groups = cancelChart.g.select('.bars').selectAll('.hotel-group')
    .data(chartData, d => d.hotel);
  
  groups.transition().duration(600)
    .attr('transform', d => `translate(${cancelChart.x(d.hotel)},0)`);
  
  const groupsEnter = groups.enter()
    .append('g')
    .attr('class', 'hotel-group')
    .attr('transform', d => `translate(${cancelChart.x(d.hotel)},0)`);
  
  const groupsMerge = groupsEnter.merge(groups);
  
  const subBars = groupsMerge.selectAll('.sub-bar')
    .data(d => [
      { type: 'confirmed', val: d.confirmed, hotel: d.hotel },
      { type: 'canceled', val: d.canceled, hotel: d.hotel }
    ], d => d.type);
  
  const colorMap = { confirmed: COLORS.success, canceled: COLORS.danger };
  const bandWidth = cancelChart.x.bandwidth() / 2 - 2;
  
  subBars.enter()
    .append('rect')
    .attr('class', 'sub-bar')
    .attr('x', (d, i) => i * (bandWidth + 4))
    .attr('width', bandWidth)
    .attr('y', cancelChart.innerHeight)
    .attr('height', 0)
    .attr('fill', d => colorMap[d.type])
    .attr('rx', 2)
    .on('mousemove', (event, d) => showTooltip(event, `${d.hotel}<br>${d.type}: ${d.val.toLocaleString()}`))
    .on('mouseleave', hideTooltip)
    .merge(subBars)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('x', (d, i) => i * (bandWidth + 4))
    .attr('width', bandWidth)
    .attr('y', d => cancelChart.y(d.val))
    .attr('height', d => cancelChart.innerHeight - cancelChart.y(d.val));
  
  subBars.exit().remove();
  groups.exit().remove();
}
 
// CHART 3: ADR TREND
let adrChart = null;
 
function buildADRChart() {
  const container = document.getElementById('chart-adr');
  const width = container.parentElement.offsetWidth - 40;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  adrChart = {
    svg: svg,
    container: container,
    width: width,
    height: height,
    margin: margin,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    x: d3.scalePoint().range([0, innerWidth]),
    y: d3.scaleLinear().range([innerHeight, 0]),
    g: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  };
  
  const g = adrChart.g;
  g.append('g').attr('class', 'grid-lines');
  g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerHeight})`);
  g.append('g').attr('class', 'y-axis');
  g.append('g').attr('class', 'lines');
 
  // CROSS-FILTER: legenda za linije (City vs Resort)
  const legend = adrChart.g.append('g')
    .attr('transform', `translate(${innerWidth - 120}, 0)`);
 
  [['City Hotel', COLORS.primary], ['Resort Hotel', COLORS.accent]].forEach(([label, color], i) => {
    const row = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
    row.append('line')
      .attr('x1', 0).attr('x2', 18)
      .attr('y1', 6).attr('y2', 6)
      .attr('stroke', color).attr('stroke-width', 2.5);
    row.append('text')
      .attr('x', 22).attr('y', 10)
      .attr('fill', '#b0b0c0').attr('font-size', '11px')
      .text(label);
  });
}
 
function updateADRChart(data) {
  if (!adrChart) buildADRChart();
  
  const hotelTypes = ['City Hotel', 'Resort Hotel'];
  const shortMonths = MONTHS.map(m => m.slice(0, 3));
  adrChart.x.domain(shortMonths);
  
  const lineData = {};
  hotelTypes.forEach(hotel => {
    lineData[hotel] = MONTHS.map(month => {
      const f = data.filter(d => d.hotel === hotel && d.month === month && d.adr > 0);
      const wavg = f.length > 0
        ? d3.sum(f, d => d.adr) / f.length
        : 0;
      return { month: month, adr: Math.round(wavg * 100) / 100 };
    });
  });
  
  const allValues = Object.values(lineData).flat().map(d => d.adr).filter(d => d > 0);
  adrChart.y.domain([d3.min(allValues) * 0.85 || 0, d3.max(allValues) * 1.1 || 200]);
  
  adrChart.g.select('.grid-lines')
    .call(d3.axisLeft(adrChart.y).ticks(5).tickSize(-adrChart.innerWidth).tickFormat(''))
    .attr('stroke', COLORS.grid)
    .call(g => g.select('.domain').remove());
  
  adrChart.g.select('.x-axis')
    .transition().duration(600)
    .call(d3.axisBottom(adrChart.x).tickSize(0))
    .call(g => g.select('.domain').remove());
  
  adrChart.g.select('.y-axis')
    .transition().duration(600)
    .call(d3.axisLeft(adrChart.y).ticks(5).tickFormat(d => '€' + d))
    .call(g => g.select('.domain').remove());
  
  const line = d3.line()
    .defined(d => d.adr > 0)
    .x(d => adrChart.x(d.month.slice(0, 3)))
    .y(d => adrChart.y(d.adr))
    .curve(d3.curveCatmullRom);
  
  const hotels = adrChart.g.select('.lines').selectAll('.line-group')
    .data(hotelTypes, d => d);
  
  const hotelsEnter = hotels.enter()
    .append('g')
    .attr('class', 'line-group');
  
  const hotelsMerge = hotelsEnter.merge(hotels);
  const colors = { 'City Hotel': COLORS.primary, 'Resort Hotel': COLORS.accent };
  
  hotelsMerge.each((hotel, i, nodes) => {
    let path = d3.select(nodes[i]).selectAll('.line-path').data([lineData[hotel]]);
    path.enter()
      .append('path')
      .attr('class', 'line-path')
      .attr('fill', 'none')
      .attr('stroke', colors[hotel])
      .attr('stroke-width', 2.5)
      .merge(path)
      .transition().duration(600).ease(d3.easeCubicOut)
      .attr('d', d => line(d));
 
    // CROSS-FILTER: točke na liniji s hover tooltip-om
    let dots = d3.select(nodes[i]).selectAll('.dot').data(lineData[hotel].filter(d => d.adr > 0));
    dots.enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('r', 4)
      .attr('fill', colors[hotel])
      .attr('stroke', '#1a1a2e')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .merge(dots)
      .transition().duration(600)
      .attr('cx', d => adrChart.x(d.month.slice(0, 3)))
      .attr('cy', d => adrChart.y(d.adr));

    dots.exit().remove();

    d3.select(nodes[i]).selectAll('.dot')
      .on('mousemove', (event, d) => {
        showTooltip(event, `${hotel}<br>${d.month}: €${d.adr}`);
      })
      .on('mouseleave', hideTooltip);
  });
  
  hotels.exit().remove();
}
 
// CHART 4: TOP COUNTRIES
let countriesChart = null;
 
function buildCountriesChart() {
  const container = document.getElementById('chart-countries');
  const width = container.parentElement.offsetWidth - 40;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 20, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  countriesChart = {
    svg: svg,
    container: container,
    width: width,
    height: height,
    margin: margin,
    innerWidth: innerWidth,
    innerHeight: innerHeight,
    x: d3.scaleLinear().range([0, innerWidth]),
    y: d3.scaleBand().range([0, innerHeight]).padding(0.15),
    g: svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  };
  
  const g = countriesChart.g;
  g.append('g').attr('class', 'grid-lines');
  g.append('g').attr('class', 'x-axis');
  g.append('g').attr('class', 'y-axis');
  g.append('g').attr('class', 'bars');
 
  svg.append('text')
    .attr('x', (width) / 2)
    .attr('y', height - 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#7a7f91')
    .attr('font-size', '10px')
    .text('Klikni na bar za filtriranje po zemlji');
}
 
function updateCountriesChart(data) {
  if (!countriesChart) buildCountriesChart();
  if (!Array.isArray(data)) data = filtered();
  
  const byCountry = d3.rollup(data,
    v => ({
      bookings: v.length,
      canceled: d3.sum(v, d => d.canceled),
      adr: (() => {
        const f = v.filter(d => d.adr > 0);
        return f.length > 0 ? d3.sum(f, d => d.adr) / f.length : 0;
      })()
    }),
    d => d.country
  );
  
  let chartData = Array.from(byCountry.entries()).map(([country, vals]) => ({
    country: country,
    bookings: vals.bookings,
    canceled: vals.canceled,
    cancel_rate: vals.bookings > 0 ? Number((vals.canceled / vals.bookings * 100).toFixed(1)) : 0,
    adr: Math.round(vals.adr * 100) / 100
  }));
  
  if (state.sortCountry === 'bookings') chartData.sort((a, b) => b.bookings - a.bookings);
  else if (state.sortCountry === 'cancel_rate') chartData.sort((a, b) => b.cancel_rate - a.cancel_rate);
  else if (state.sortCountry === 'adr') chartData.sort((a, b) => b.adr - a.adr);
  
  chartData = chartData.slice(0, 10);
  
  countriesChart.y.domain(chartData.map(d => d.country));
  
  const getValue = d => {
    if (state.sortCountry === 'cancel_rate') return d.cancel_rate;
    if (state.sortCountry === 'adr') return d.adr;
    return d.bookings;
  };
  
  countriesChart.x.domain([0, d3.max(chartData, getValue) * 1.1 || 1]);
  
  countriesChart.g.select('.grid-lines')
    .call(d3.axisTop(countriesChart.x).ticks(5).tickSize(-countriesChart.innerHeight).tickFormat(''))
    .attr('stroke', COLORS.grid)
    .call(g => g.select('.domain').remove());
  
  countriesChart.g.select('.x-axis')
    .transition().duration(600)
    .call(d3.axisTop(countriesChart.x).ticks(5).tickFormat(
      state.sortCountry === 'adr' ? d => '€' + d.toFixed(0) :
      state.sortCountry === 'cancel_rate' ? d => d.toFixed(0) + '%' :
      d3.format(',')
    ))
    .call(g => g.select('.domain').remove());
  
  countriesChart.g.select('.y-axis')
    .transition().duration(600)
    .call(d3.axisLeft(countriesChart.y).tickSize(0))
    .call(g => g.select('.domain').remove());
  
  const bars = countriesChart.g.select('.bars').selectAll('.bar')
    .data(chartData, d => d.country);
  
  bars.enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('y', d => countriesChart.y(d.country))
    .attr('height', countriesChart.y.bandwidth())
    .attr('x', 0)
    .attr('width', 0)
    .attr('rx', 2)
    // CROSS-FILTER: klik na country bar mijenja state.country dropdown i filtrira sve
    .on('click', (event, d) => {
      const newVal = state.country === d.country ? 'all' : d.country;
      state.country = newVal;
      document.getElementById('country-filter').value = newVal;
      updateAll();
    })
    .on('mousemove', (event, d) => {
      const val = getValue(d);
      const label = state.sortCountry === 'adr' ? '€' + val.toFixed(0) :
                   state.sortCountry === 'cancel_rate' ? val + '%' :
                   val.toLocaleString();
      const hint = state.country === d.country ? ' (klikni za uklanjanje)' : ' (klikni za filtriranje)';
      showTooltip(event, `${d.country}<br>${label}${hint}`);
    })
    .on('mouseleave', hideTooltip)
    .merge(bars)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr('y', d => countriesChart.y(d.country))
    .attr('height', countriesChart.y.bandwidth())
    .attr('width', d => countriesChart.x(getValue(d)))
    // CROSS-FILTER: highlight odabrane zemlje, ostale dimmed
    .attr('fill', (d, i) => {
      if (state.country === d.country) return COLORS.accent;
      return d3.interpolateViridis(0.1 + i * 0.08);
    })
    .attr('opacity', d => {
      if (state.country === 'all') return 1;
      return state.country === d.country ? 1 : 0.35;
    });
  
  bars.exit().remove();
}
 
// CHART 5: MARKET SEGMENTS
let segmentChart = null;
 
function buildSegmentChart() {
  const container = document.getElementById('chart-segments');
  const width = container.parentElement.offsetWidth - 40;
  const height = 280;
  const radius = Math.min(width, height) / 2 - 20;
  
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  
  segmentChart = {
    svg: svg,
    container: container,
    width: width,
    height: height,
    radius: radius,
    g: svg.append('g').attr('transform', `translate(${width/2},${height/2})`)
  };
  
  segmentChart.arc = d3.arc()
    .innerRadius(radius * 0.6)
    .outerRadius(radius);
 
  // CROSS-FILTER: arc za hover/active state (veći)
  segmentChart.arcHover = d3.arc()
    .innerRadius(radius * 0.6)
    .outerRadius(radius + 8);
  
  segmentChart.pie = d3.pie().value(d => d.bookings).sort(null);
  
  segmentChart.g.append('g').attr('class', 'arcs');
 
  // CROSS-FILTER: hint tekst u sredini donut-a
  segmentChart.g.append('text')
    .attr('class', 'donut-hint')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('fill', '#7a7f91')
    .attr('font-size', '10px')
    .text('Klikni segment');
}
 
function updateSegmentChart(data) {
  if (!segmentChart) buildSegmentChart();
  
  // Za segment chart koristimo podatke BEZ activeSegment filtera
  // da uvijek vidimo sve segmente, ali dimmed neaktivne
  const baseData = RAW_DATA.filter(d => {
    if (state.hotel !== 'all' && d.hotel !== state.hotel) return false;
    if (state.year !== 'all' && d.year !== state.year) return false;
    if (state.country !== 'all' && d.country !== state.country) return false;
    if (state.activeMonth !== null && d.month !== state.activeMonth) return false;
    return true;
  });
 
  const bySegment = d3.rollup(baseData, v => d3.sum(v, d => d.bookings), d => d.segment);
  const chartData = SEGMENTS.map((seg, i) => ({
    segment: seg,
    bookings: bySegment.get(seg) || 0,
    color: SEG_COLORS[i]
  })).filter(d => d.bookings > 0);
  
  const pie = segmentChart.pie(chartData);
  
  const arcs = segmentChart.g.select('.arcs').selectAll('.arc')
    .data(pie, d => d.data.segment);
  
  arcs.enter()
    .append('path')
    .attr('class', 'arc')
    .attr('stroke', '#1a1a2e')
    .attr('stroke-width', 2)
    .each(function(d) { this._current = { startAngle: d.startAngle, endAngle: d.startAngle }; })
    // CROSS-FILTER: klik na segment postavlja activeSegment
    .on('click', (event, d) => {
      setCrossFilter('segment', d.data.segment);
    })
    .on('mousemove', (event, d) => {
      const total = d3.sum(chartData, x => x.bookings);
      const pct = ((d.data.bookings / total) * 100).toFixed(1);
      const hint = state.activeSegment === d.data.segment ? ' (klikni za uklanjanje)' : ' (klikni za filtriranje)';
      showTooltip(event, `${d.data.segment}<br>${d.data.bookings.toLocaleString()} (${pct}%)${hint}`);
    })
    .on('mouseleave', hideTooltip)
    .merge(arcs)
    // CROSS-FILTER: opacity dimming neaktivnih segmenata
    .attr('opacity', d => {
      if (!state.activeSegment) return 1;
      return state.activeSegment === d.data.segment ? 1 : 0.3;
    })
    .attr('fill', d => d.data.color)
    .transition().duration(600).ease(d3.easeCubicOut)
    .attrTween('d', function(d) {
      const isActive = state.activeSegment === d.data.segment;
      const arcFn = isActive ? segmentChart.arcHover : segmentChart.arc;
      const i = d3.interpolate(this._current, d);
      this._current = d;
      return t => arcFn(i(t));
    });
  
  arcs.exit().remove();
 
  // CROSS-FILTER: hint tekst u sredini mijenja se kad je segment aktivan
  segmentChart.g.select('.donut-hint')
    .text(state.activeSegment ? state.activeSegment : 'Klikni segment');
  
  const legend = document.getElementById('segment-legend');
  legend.innerHTML = '';
  chartData.forEach(d => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.style.cursor = 'pointer';
    item.style.opacity = !state.activeSegment || state.activeSegment === d.segment ? '1' : '0.4';
    item.style.transition = 'opacity 0.3s';
    item.innerHTML = `
      <div class="legend-dot" style="background: ${d.color}; ${state.activeSegment === d.segment ? 'box-shadow: 0 0 6px ' + d.color : ''}"></div>
      <span>${d.segment}</span>
    `;
    // CROSS-FILTER: klik na legendu isto filtrira
    item.addEventListener('click', () => setCrossFilter('segment', d.segment));
    legend.appendChild(item);
  });
}
 
 
// ANIMATION
function toggleAnimation() {
  if (state.animPlaying) stopAnimation();
  else startAnimation();
}
 
function startAnimation() {
  state.animPlaying = true;
  state.animYear = 2015;
  const btn = document.getElementById('play-btn');
  btn.textContent = '⏸ Pause';
  
  function step() {
    if (!state.animPlaying) return;
    
    document.querySelectorAll('#year-filter .btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === String(state.animYear));
    });
    
    state.year = String(state.animYear);
    updateAll();
    
    if (state.animYear < 2017) {
      state.animYear++;
      state.animTimer = setTimeout(step, 1200);
    } else {
      state.animYear = 2015;
      state.animTimer = setTimeout(step, 1800);
    }
  }
  
  step();
}
 
function stopAnimation() {
  state.animPlaying = false;
  clearTimeout(state.animTimer);
  document.getElementById('play-btn').textContent = '▶ Play Animation';
}
 
// TOOLTIP HELPERS
function showTooltip(event, html) {
  tooltip.html(html).classed('visible', true);
  moveTooltip(event);
}
 
function hideTooltip() {
  tooltip.classed('visible', false);
}
 
function moveTooltip(event) {
  const pad = 12;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  const width = 200;
  const height = 70;
  
  if (x + width > window.innerWidth) x = event.clientX - width - pad;
  if (y + height > window.innerHeight) y = event.clientY - height - pad;
  
  tooltip.style('left', x + 'px').style('top', y + 'px');
}
 
// BUILD ALL CHARTS
function buildAllCharts() {
  buildMonthlyChart();
  buildCancelChart();
  buildADRChart();
  buildCountriesChart();
  buildSegmentChart();
}