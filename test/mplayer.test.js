const assert = require("assert");
const path = require("path");
const Promise = require("bluebird");
const sampleFile = path.join(__dirname, "sample.mp3");

var MPlayer = require("../index.js");

describe("MPlayer test", () => {
    it("will spawn", async () => {
        var player = new MPlayer();

        return player.spawn().finally(() => player.kill());
    });

    it("will throw an eror with wrong path", (done) => {
        var player = new MPlayer({
            playerPath: "fake"
        });

        player.spawn()
            .then(() => done("Spawned even though doesn't exist"))
            .catch(() => done())
    });

    it("will exit", async () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then(() => Promise.delay(250))
            .then(() => player.kill());
    });

    it("will load a file", async () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then((player) => player.loadFile(sampleFile))
            .finally(() => player.kill());
    });

    it("will play a file", async () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then(() => player.loadFile(sampleFile))
            .then(() => player.play())
            .then(() => Promise.delay(1000))
            .finally(() => player.kill());
    }).timeout(10000);

    it("will pause a file", async () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then((player) => player.loadFile(sampleFile))
            .then((player) => player.play())
            .then(Promise.delay(250))
            .then(() => player.pause())
            .finally(() => player.kill());
    });

    it("will pause and restart file", () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then(() => player.loadFile(sampleFile))
            .then(() => player.play())
            .then(() => Promise.delay(250))
            .then(() => player.pause())
            .then(() => Promise.delay(250))
            .then(() => player.play())
            .finally(() => player.kill());
    });

    it("will pause and restart file", () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then(() => player.loadFile(sampleFile))
            .then(() => player.play())
            .then(() => player.setSpeed(1.5))
            .then(() => player.getProperty("speed"))
            .then((value) => assert.equal(value, 1.5))
            .finally(() => player.kill());
    });

    it("will seek", () => {
        var player = new MPlayer();

        return player
            .spawn()
            .then(() => player.loadFile(sampleFile))
            .then(() => player.play())
            .then(() => player.seek(1000))
            .then(() => Promise.delay(500))
            .then(() => player.seek(1000))
            .then(() => Promise.delay(500))
            .then(() => player.seek(1000))
            .finally(() => player.kill());
    });
});
