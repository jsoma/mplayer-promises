const EventEmitter = require("events").EventEmitter;
const spawn = require("child_process").spawn;
const path = require("path");
const os = require("os");

var defaultArgs = [
    "-msglevel",
    "global=6",
    "-msglevel",
    "cplayer=4",
    "-idle",
    "-slave",
    "-fs",
    "-noborder",
    "-af",
    "scaletempo",
];

function isWindows() {
    return os.platform() == "win32";
}

class LogMessage {
    constructor(text) {
        this.data = text.toString().replace(/^\s*/, "");
        this.setEvent();
    }

    setEvent() {
        const events = [
            ["MPlayer", "ready"],
            ["Starting playback...", "playstart"],
            ["ANS_AUDIO_CODEC", "paused"],
            ["Exiting...", "exiting"],
            [
                "Playing ",
                "loaded",
                () => {
                    return [this.data.match(/Playing\s(.+?)\.\b/)[1]];
                },
            ],
            ["ANS_", "property", () => this.data.trim().split("=")],
            [
                "EOF code:",
                "playstop",
                () => {
                    return [parseInt(this.data.match(/EOF code: (\d+)/)[1])];
                },
            ],
            [
                "A:",
                "timechange",
                () => {
                    return [parseFloat(this.data.match(/A:\s+([-\d\.]+)/)[1])];
                },
            ],
            [
                "Failed to open",
                "openfail",
                () => {
                    let filename = this.data.match(
                        /Failed to open\s(.+?)\.\s/
                    )[1];
                    return [new Error(`Could not find ${filename}`)];
                },
            ],
        ];

        for (let i = 0; i < events.length; i++) {
            if (this.data.indexOf(events[i][0]) !== -1) {
                this.eventName = events[i][1];
                this.arguments =
                    events[i].length > 2 ? events[i][2].call(this) : [];
                return;
            }
        }
    }

    fireEvent(context) {
        if (this.eventName) {
            if (this.arguments) {
                context.emit(this.eventName, ...this.arguments);
            } else {
                context.emit(this.eventName);
            }
        } else {
            // Skipping if we don't know about it
        }
    }
}

class MPlayer extends EventEmitter {
    constructor(options) {
        super();
        this.options = {
            verbose: false,
            debug: false,
        };
        Object.assign(this.options, options);
        this.playerPath =
            this.options.playerPath ||
            (isWindows()
                ? path.resolve(__dirname, "./mplayerwin/mplayer.exe")
                : "mplayer");
        this.args = [];
    }

    async spawn() {
        return new Promise((resolve, reject) => {
            this.once("ready", () => {
                resolve(this);
            });

            this.instance = spawn(
                this.playerPath,
                defaultArgs.concat(this.args)
            );
            this.instance.on('error', (err) => {
                reject(new Error("mplayer not installed"));
            });
            this.instance.stdout.on("data", this.onData.bind(this));
            this.instance.stderr.on("data", this.onError.bind(this));
        }).then(this.attachListeners.bind(this));
    }

    async attachListeners() {
        this.on("timechange", (time) => {
            this.position = time;
            this.emit("time", time);
        });
        return this;
    }

    async kill() {
        return new Promise((resolve) => {
            this.once("exiting", () => {
                resolve(this);
            });
            this.send("quit");
        }).catch(() => new Error("Did not exit"));
    }

    log(string, level) {
        if (this.options.debug) {
            console.log(level, string);
        }
    }

    async delayedKill() {
        setTimeout(() => {
            this.instance.stdin.pause();
            this.instance.kill();
        }, 100);
    }

    async loadFile(filename, autoplay = false) {
        if (isWindows) {
            filename = filename.replace(/\\/g, "/");
        }

        return new Promise((resolve, reject) => {
            let loadDelay;

            // If it fails,
            const fireFailed = (error) => {
                // Remove all of the other listeners
                this.off("loaded", fireLoadedAfterDelay);
                if (loadDelay) clearTimeout(loadDelay);
                reject(error);
            };

            // If it seems to work,
            const fireLoadedAfterDelay = () => {
                // Let's wait a few MS to be sure
                loadDelay = setTimeout(() => {
                    this.off("openfail", fireFailed);
                    resolve(this);
                }, 25);
            };

            this.once("openfail", fireFailed);
            this.once("loaded", fireLoadedAfterDelay);

            if (autoplay) {
                this.send("loadfile", [`"${filename}"`]);
            } else {
                this.send("pausing loadfile", [`"${filename}"`]);
            }
        });
    }

    async skip(ms) {
        this.send("seek", [ms / 1000, 0]);
        return Promise.resolve(this);
    }

    async seek(ms) {
        this.send("seek", [ms / 1000, 2]);
        return Promise.resolve(this);
    }

    async pause() {
        return new Promise((resolve) => {
            this.once("paused", () => {
                resolve(this);
            });
            // There's no logging when paused, so we get the audio codec
            this.send("pausing get_audio_codec");
        });
    }

    async setSpeed(newSpeed) {
        this.send("speed_set", newSpeed);
        return Promise.resolve(this);
    }

    async getProperty(propname) {
        return new Promise((resolve) => {
            this.once("property", (property, value) => {
                resolve(value);
            });
            this.send("get_property", propname);
        });
    }

    async play() {
        return new Promise((resolve) => {
            this.once("timechange", () => {
                resolve(this);
            });
            this.send("pausing_toggle pause");
        });
    }

    send(command, args) {
        args = args || [];
        if (typeof args.length === "undefined") {
            args = [args];
        }
        const full = [command].concat(args).join(" ") + "\n";

        if (this.options.debug) {
            console.log("SENDING", full);
        }

        this.instance.stdin.write(full);
    }

    onData(data) {
        const msg = new LogMessage(data);
        this.log(msg.data, "STDOUT");
        msg.fireEvent(this);
    }

    onError(data) {
        const msg = new LogMessage(data);
        this.log(msg.data, "STDERR");
        msg.fireEvent(this);

        if (data.indexOf("Failed to open ") !== -1) {
            var file = data.match(/Failed to open\s(.+?)\.\s/)[1];
            this.emit("openfail", new Error(`Could not find ${file}`));
        }
    }
}

module.exports = MPlayer;
