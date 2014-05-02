define(['time', 'gfx', 'res'], function(time, gfx, res) {
    // Override default requestAnimationFrame for maximum compatibility.
    var requestAnimationFrame = window.requestAnimationFrame
                           || window.mozRequestAnimationFrame
                           || window.webkitRequestAnimationFrame
                           || window.msRequestAnimationFrame
                           || function(func) { setTimeout(func, 1000/60) };

    function run() {
        res.load(function() {
            gfx.init(800, 600);

            // Bubble render test
            var spr = new PIXI.Sprite(res.bubbleTex);
            gfx.stage.addChild(spr);

            update();
        });
    }

    function update() {
        // state stuff here

        time.update();

        gfx.render();

        requestAnimationFrame(update);
    }

    return {
        requestAnimationFrame: requestAnimationFrame,
        run: run,
    };
});
