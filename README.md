# Time Progress

How much of the year, the month, your own span or your life has already passed.

A JavaScript app for [BUSY Bar](https://busy.app). Work in progress.

## What it does

- The front display shows two lines with progress bars, such as `2026 87%` and `NOV 43%`.
- The year can start on any date, such as your birthday, and the month on any day, such as your payday; both can carry your own label.
- The wheel switches the second line between month, week, day, your own span between two dates (such as `BABY 63%`) and your life (`LIFE 45%`, from your birth date and the years you set).
- Two more wheel views light one pixel per unit: the days of the year, and the months of your life.
- Every new whole percent of the year sends a spark along its bar.
- Time comes from the BUSY Bar's own clock.

## Data

None: it works offline.

## Build

Node 24 and npm:

```sh
npm ci
npm run build         # dist/io.github.vvzvlad.timeprogress.tgz
npm run app:install   # install it on a BUSY Bar connected over USB
npm run app:run       # start it
```

## License

[MIT](LICENSE)
