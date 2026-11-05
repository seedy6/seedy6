// Prints the start date of every Umm al-Qura Hijri month from START_YEAR to END_YEAR
// as JSON [[hijriYear, hijriMonth, "YYYY-MM-DD"], ...]. The 2015 TV has no Intl calendars,
// so the app reads this table instead.
const [startYear, endYear] = process.argv.slice(2).map(Number);
const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
const out = [];
for (let t = Date.UTC(startYear, 0, 1); t < Date.UTC(endYear + 1, 0, 1); t += 86400000) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  if (Number(p.day) === 1) out.push([parseInt(p.year, 10), Number(p.month), new Date(t).toISOString().slice(0, 10)]);
}
console.log(JSON.stringify(out));
