# Description

Promises-based MPlayer interface.

> Bundled with Windows MPlayer binaries because setting up PATH stuff there is a real pain. See license in [/mplayerwin/](mplayerwin/).

## How to install

```
npm install mplayer-bin
```

On OS X, you'll additionally need to `brew install mplayer` (or install some other way).

## How to use

I recommend looking at [the tests](test/), but:

```python
var player = new MPlayer();

player
    .spawn()
    .then(() => player.loadFile("sample.mp3"))
    .then(() => player.play())
    .then(() => Promise.delay(2000))
    .then(() => player.seek(1000))
    .then(() => player.setSpeed(1.5))
    .then(() => Promise.delay(2000))
    .then(() => player.pause())
    .then(() => player.kill());
```

Or you can be fancy and use `await` if you'd really like.