define(['time', 'gfx', 'res', 'states'], function(time, gfx, res, states) {
    // Override default requestAnimationFrame for maximum compatibility.
    var requestAnimationFrame = window.requestAnimationFrame
                           || window.mozRequestAnimationFrame
                           || window.webkitRequestAnimationFrame
                           || window.msRequestAnimationFrame
                           || function(func) { setTimeout(func, 1000/60) };

    var currentState;
    var currentStateInit = false;

    function run() {
        //setState(new states.BubbleRenderTest());
        setState(new states.PinRenderTest());

        var bpm = this;
        res.load(function() {
            gfx.init(800, 600);
            dbg.addStateButtons(bpm, states);
            update();
        });
    }

    function update() {
        if (currentState) {
            if (!currentStateInit) {
                currentState.init();
                currentStateInit = true;
            }
            currentState._update(time.delta);
        }

        time.update();

        gfx.render();

        requestAnimationFrame(update);
    }

    function setState(state) {
        if (currentState) {
            currentState._onSwitch();
        }
        currentState = state;
        currentStateInit = false;
    }

    return {
        requestAnimationFrame: requestAnimationFrame,
        run: run,
        setState: setState,
    };
});
