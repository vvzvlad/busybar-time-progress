# Year Progress

How much of the year, the month, the week and the day has already passed.

A JavaScript app for [BUSY Bar](https://busy.app). Work in progress.

## What it does

- The front display shows two lines with progress bars, such as `2026 87%` and `NOV 43%`.
- The wheel switches between year, month, week and day.
- Every new whole percent of the year plays a short animation.
- Time comes from the BUSY Bar's own clock.

## Data

None: it works offline.

## Build

Node 24 and npm:

```sh
npm ci
npm run build         # dist/io.github.vvzvlad.yearprogress.tgz
npm run app:install   # install it on a BUSY Bar connected over USB
npm run app:run       # start it
```

## License

[MIT](LICENSE)
