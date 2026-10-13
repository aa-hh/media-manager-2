const dayKey = (at: number) => new Date(at).toDateString();
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const shortDate = (at: number) => shortDateFormat.format(at);
const clock = (at: number) => clockFormat.format(at);

export const dayTitle = (at: number, now = Date.now()) => {
  if (dayKey(at) === dayKey(now)) return 'Today';
  // Calendar arithmetic, not now minus 24 hours: the day after a daylight-saving change is 23 or 25 hours long.
  const today = new Date(now);
  if (dayKey(at) === new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString()) return 'Yesterday';
  return shortDate(at);
};

// Times today and yesterday are under their day's heading; older ones carry their date.
export const formatWhen = (at: number, now = Date.now()) => (
  dayTitle(at, now) === shortDate(at) ? `${shortDate(at)} ${clock(at)}` : clock(at)
);
