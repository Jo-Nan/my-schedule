const HOLIDAY_SOURCE = {
  official: 'official',
  projected: 'projected',
};

const HOLIDAY_COLORS = {
  new_year: '#ef4444',
  spring_festival: '#ef4444',
  qingming: '#f97316',
  labor_day: '#fb7185',
  dragon_boat: '#06b6d4',
  mid_autumn: '#8b5cf6',
  national_day: '#dc2626',
};

const HOLIDAY_RANGES = [
  { key: 'new_year', label: '元旦', start: '2026-01-01', end: '2026-01-03', source: HOLIDAY_SOURCE.official },
  { key: 'spring_festival', label: '春节', start: '2026-02-15', end: '2026-02-23', source: HOLIDAY_SOURCE.official },
  { key: 'qingming', label: '清明节', start: '2026-04-04', end: '2026-04-06', source: HOLIDAY_SOURCE.official },
  { key: 'labor_day', label: '劳动节', start: '2026-05-01', end: '2026-05-05', source: HOLIDAY_SOURCE.official },
  { key: 'dragon_boat', label: '端午节', start: '2026-06-19', end: '2026-06-21', source: HOLIDAY_SOURCE.official },
  { key: 'mid_autumn', label: '中秋节', start: '2026-09-25', end: '2026-09-27', source: HOLIDAY_SOURCE.official },
  { key: 'national_day', label: '国庆节', start: '2026-10-01', end: '2026-10-07', source: HOLIDAY_SOURCE.official },

  { key: 'new_year', label: '元旦', start: '2027-01-01', end: '2027-01-01', source: HOLIDAY_SOURCE.projected },
  { key: 'spring_festival', label: '春节', start: '2027-02-06', end: '2027-02-11', source: HOLIDAY_SOURCE.projected },
  { key: 'qingming', label: '清明节', start: '2027-04-03', end: '2027-04-05', source: HOLIDAY_SOURCE.projected },
  { key: 'labor_day', label: '劳动节', start: '2027-05-01', end: '2027-05-05', source: HOLIDAY_SOURCE.projected },
  { key: 'dragon_boat', label: '端午节', start: '2027-06-09', end: '2027-06-11', source: HOLIDAY_SOURCE.projected },
  { key: 'mid_autumn', label: '中秋节', start: '2027-09-15', end: '2027-09-15', source: HOLIDAY_SOURCE.projected },
  { key: 'national_day', label: '国庆节', start: '2027-10-01', end: '2027-10-03', source: HOLIDAY_SOURCE.projected },

  { key: 'new_year', label: '元旦', start: '2028-01-01', end: '2028-01-01', source: HOLIDAY_SOURCE.projected },
  { key: 'spring_festival', label: '春节', start: '2028-01-26', end: '2028-01-31', source: HOLIDAY_SOURCE.projected },
  { key: 'qingming', label: '清明节', start: '2028-04-02', end: '2028-04-04', source: HOLIDAY_SOURCE.projected },
  { key: 'labor_day', label: '劳动节', start: '2028-05-01', end: '2028-05-05', source: HOLIDAY_SOURCE.projected },
  { key: 'dragon_boat', label: '端午节', start: '2028-06-25', end: '2028-06-27', source: HOLIDAY_SOURCE.projected },
  { key: 'mid_autumn', label: '中秋节', start: '2028-10-03', end: '2028-10-03', source: HOLIDAY_SOURCE.projected },
  { key: 'national_day', label: '国庆节', start: '2028-10-01', end: '2028-10-07', source: HOLIDAY_SOURCE.projected },

  { key: 'new_year', label: '元旦', start: '2029-01-01', end: '2029-01-01', source: HOLIDAY_SOURCE.projected },
  { key: 'spring_festival', label: '春节', start: '2029-02-13', end: '2029-02-18', source: HOLIDAY_SOURCE.projected },
  { key: 'qingming', label: '清明节', start: '2029-04-02', end: '2029-04-04', source: HOLIDAY_SOURCE.projected },
  { key: 'labor_day', label: '劳动节', start: '2029-05-01', end: '2029-05-05', source: HOLIDAY_SOURCE.projected },
  { key: 'dragon_boat', label: '端午节', start: '2029-06-15', end: '2029-06-17', source: HOLIDAY_SOURCE.projected },
  { key: 'mid_autumn', label: '中秋节', start: '2029-09-21', end: '2029-09-23', source: HOLIDAY_SOURCE.projected },
  { key: 'national_day', label: '国庆节', start: '2029-10-01', end: '2029-10-03', source: HOLIDAY_SOURCE.projected },

  { key: 'new_year', label: '元旦', start: '2030-01-01', end: '2030-01-01', source: HOLIDAY_SOURCE.projected },
  { key: 'spring_festival', label: '春节', start: '2030-02-03', end: '2030-02-08', source: HOLIDAY_SOURCE.projected },
  { key: 'qingming', label: '清明节', start: '2030-04-05', end: '2030-04-07', source: HOLIDAY_SOURCE.projected },
  { key: 'labor_day', label: '劳动节', start: '2030-05-01', end: '2030-05-05', source: HOLIDAY_SOURCE.projected },
  { key: 'dragon_boat', label: '端午节', start: '2030-06-03', end: '2030-06-05', source: HOLIDAY_SOURCE.projected },
  { key: 'mid_autumn', label: '中秋节', start: '2030-09-12', end: '2030-09-14', source: HOLIDAY_SOURCE.projected },
  { key: 'national_day', label: '国庆节', start: '2030-10-01', end: '2030-10-03', source: HOLIDAY_SOURCE.projected },
];

const toDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const expandRange = (start, end) => {
  const result = [];
  const current = toDate(start);
  const endDate = toDate(end);

  while (current <= endDate) {
    result.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
};

const HOLIDAY_MAP = HOLIDAY_RANGES.reduce((acc, item) => {
  expandRange(item.start, item.end).forEach((dateStr) => {
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
  });
  return acc;
}, {});

export const getHolidayInfo = (dateStr) => {
  const holidays = HOLIDAY_MAP[dateStr] || [];
  if (holidays.length === 0) return null;

  const labels = holidays.map((item) => item.label);
  const primary = holidays[holidays.length - 1];

  return {
    key: primary.key,
    label: labels.join(' / '),
    color: HOLIDAY_COLORS[primary.key] || '#ef4444',
    source: primary.source,
    isOfficial: holidays.some((item) => item.source === HOLIDAY_SOURCE.official),
  };
};

export const getHolidayRangesForYear = (year) => {
  return HOLIDAY_RANGES.filter((item) => item.start.startsWith(String(year)));
};

export const getHolidaySourceLabel = (dateStr) => {
  const info = getHolidayInfo(dateStr);
  if (!info) return null;
  return info.isOfficial ? 'official' : 'projected';
};
