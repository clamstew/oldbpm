define(['bpm', 'objects', 'gfx', 'res', 'input', 'ui', 'events', 'quests', 'upgrades'], function(bpm, objects, gfx, res, input, ui, events, quests, upgrades) {
    var global = {
        current: null,
        previous: null,
        switchState: null, // Flag; =function when state is prepped to be switched
    };

    // Static Methods
    function setState(newState, options) {
        options = options || {};
        _.defaults(options, {
            initNew: true,
            destroyOld: true,
        });

        // Set to null in main on successful switch.
        global.switchState = _.bind(function() {
            // If there's currently a state, set it to the previous state and destroy it.
            if (global.current) {
                global.previous = global.current;
                if (options.destroyOld) {
                    global.previous.destroy();
                }
            }

            // Set the current state to the new state, initialize and clear the new state.
            global.current = newState;
            if (options.initNew) {
                global.current.init();
            }
        }, this);
    }

    // Classes
    var State = function() {
        events.EventHandler.call(this);
        this.displayObjectContainer = new gfx.pixi.DisplayObjectContainer();
        this.objects = [];
        this.objectsToAdd = [];
        this.objectsToRemove = [];
        this.paused = false;

        this.initialized = false;
    };
        State.prototype = Object.create(events.EventHandler.prototype);
        State.prototype.constructor = State;

        State.prototype.init = function() {
            if (this.initialized) {
                console.error("State has been reinitialized. Only call 'init' if object has been destroyed.");
            }
            this.initialized = true;
            gfx.stage.addChild(this.displayObjectContainer);

            // Use the default cursor for all states.
            var cursor = new gfx.pixi.Sprite(res.tex.cursorDefault);
            this.setCursor(cursor);
        };

        // When this state has been switched
        State.prototype.destroy = function() {
            // Remove all objects
            for (var i=0; i<this.objects.length; ++i) {
                this.objects[i].destroy(this);
            }

            // Remove all children from display objects.
            while (this.displayObjectContainer.children.length > 0) {
                this.displayObjectContainer.removeChildAt(0);
            }

            this.initialized = false;
        };

        State.prototype.update = function(delta) {
            if (this.cursor) {
                this.cursor.x = input.mouse.x;
                this.cursor.y = input.mouse.y;
            }

            if (!this.paused) {
                // Add queued objects
                if (this.objectsToAdd.length > 0) {
                    for (var i=0; i<this.objectsToAdd.length; ++i) {
                        var obj = this.objectsToAdd[i];

                        this.objects.push(obj);
                        obj.init(this);
                    }
                    gfx.sortStageDisplays = true;
                    this.objectsToAdd = [];
                }

                // Remove queued objects
                for (var i=0; i<this.objectsToRemove.length; ++i) {
                    var obj = this.objectsToRemove[i];
                    var index = this.objects.indexOf(obj);

                    if (index !== -1) {
                        this.objects.splice(index, 1);
                        obj.destroy(this);
                    }
                }
                this.objectsToRemove = [];

                for (var i=0; i<this.objects.length; ++i) {
                    this.objects[i].update(delta);
                }
            }

            if (input.key.isPressed('G')) {
                this.showCutscene('myCutscene');
            }
        };

        State.prototype.add = function(obj) {
            var ret = obj;
            if (!_.isArray(obj))
                obj = [obj];

            for (var i = 0; i < obj.length; i++)
                this.objectsToAdd.push(obj[i]);

            return ret;
        };

        State.prototype.remove = function(obj) {
            var ret = obj;
            if (!_.isArray(obj))
                obj = [obj];

            for (var i = 0; i < obj.length; i++)
                this.objectsToRemove.push(obj[i]);


            return ret;
        };

        State.prototype.addDisplay = function(display, container) {
            if (container) {
                container.addChild(display);
            } else {
                this.displayObjectContainer.addChild(display);
            }
            return display;
        };

        State.prototype.removeDisplay = function(display) {
            if (display.parent === undefined) {
                console.error('DisplayObject parent is undefined. Adding the display multiple times may have caused this.');
            }
            display.parent.removeChild(display);
            return display;
        };

        State.prototype.setCursor = function(textureOrSprite) {
            if (this.cursor) {
                this.removeDisplay(this.cursor);
            }

            if (textureOrSprite instanceof gfx.pixi.Texture) {
                this.cursor = new gfx.pixi.Sprite(textureOrSprite);
                this.cursor.anchor.x = this.cursor.anchor.y = 0.5;
            } else {
                this.cursor = textureOrSprite;
            }

            this.cursor.depth = -1000;
            this.addDisplay(this.cursor);
        };

        State.prototype.pause = function(pauseState) {
            if (pauseState) {
                if (typeof pauseState === 'function') {
                    setState(new pauseState(this), { destroyOld: false });
                } else if (typeof pauseState === 'object') {
                    setState(pauseState, { destroyOld: false });
                }
                this.pauseState = global.current;
            }

            this.paused = true;
            this.onPause();
        };

        State.prototype.restore = function() {
            if (this.paused) {
                if (this.pauseState) {
                    setState(this, { initNew: false });
                    this.pauseState = null;
                }

                this.paused = false;
                this.onRestore();
            }
        };

        State.prototype.showCutscene = function(name) {
            console.log('Starting cutscene');
            var cutscene = new CutsceneState(this, name);
            this.pause(cutscene);
        };

        State.prototype.onPause = function() {};
        State.prototype.onRestore = function() {};


    var Field = function() {
        State.call(this);
        this.comboTime = 1000;
        this.comboTimer = this.comboTime;
        this.multiplier = 1;
        this.combo = 0;
        this.comboGoal = 4;

        this.bubbles = [];
        this.savedWeapons = {};

        this.xp = 0;

        if (bpm.player.currentQuest) {
            this.currentQuest = bpm.player.currentQuest;
        } else {
            console.error('No current quest!');
        }

        this.roundTimerComplete = false;
        this.skipDay = false;
        this.timeBonus = 0; // Ratio of round timer when quest is completed.

        this.addListener('bubblePopped', function() {
            quests.updateObjective('popBubbles');
        });

        // Hotkey setup
        // Menus require a unique setup so we can call the constructor from this array
        this.menuHotkeys = [
            [TownMenu, bpm.hotkeys.menus['TownMenu']],
            [FieldPauseMenu, bpm.hotkeys.menus['FieldPauseMenu']]
        ];

        this.hotkeys = {
            menus: this.menuHotkeys,
            weapons: bpm.hotkeys.weapons,
            actions: bpm.hotkeys.actions
        };
    };
        Field.prototype = Object.create(State.prototype);
        Field.prototype.constructor = Field;

        Field.prototype.init = function() {
            State.prototype.init.call(this);

            var commonTextStyle = {
                stroke: 'black',
                strokeThickness: 4,
                fill: 'white',
                align: 'left',
            };

            var randBub = function(armor) {
                return new objects.Bubble(armor, randomRange(32, gfx.width-32), randomRange(-128, gfx.height / 4), Math.random() * 360);
            };


            this.background = this.addDisplay(new gfx.pixi.TilingSprite(res.tex.background, 800, 600));
            this.background.depth = gfx.layers.background;


            var pauseButton = new ui.Button('Pause Game', {font: 'bold 12px arial'}, _.bind(function() {
                this.onBlur();
            }, this));
            pauseButton.x = gfx.width - pauseButton.width - 5;
            pauseButton.y = gfx.height - pauseButton.height - 5;
            this.add(pauseButton);


            this.setWeapon(bpm.player.currentWeapon);

            // Basic spawner
            this.bubbleSpawner = new objects.Timer(1000, 'loop', _.bind(function() {
                this.add(randBub(0));
                if (randomRange(1, 10) == 10)
                    this.add(randBub(3));
            }, this));
            //this.add(this.bubbleSpawner);


            // Circle round timer
            this.roundTimer = new objects.Timer((this.currentQuest.time || 60) * 1000, 'oneshot', _.bind(function() {
                this.remove(this.bubbleSpawner);
                this.addDisplay(this.roundTimerEndText);
                this.roundTimerComplete = true;
            }, this));

            var roundCirc = new gfx.pixi.Graphics();
            var roundCircRadius = 48;
            roundCirc.x = gfx.width-roundCircRadius;
            roundCirc.y = roundCircRadius;
            roundCirc.depth = gfx.layers.gui;
            this.addDisplay(roundCirc);

            var drawRoundCirc = function(ratio, color, alpha) {
                roundCirc.beginFill(color, alpha);
                    roundCirc.moveTo(0,0);
                    for (var i=0; i<ratio*360; ++i) {
                        var rad = i * DEG2RAD;
                        roundCirc.lineTo(Math.sin(rad) * roundCircRadius,  -Math.cos(rad) * roundCircRadius);
                    }
                roundCirc.endFill();
            };

            this.roundTimer.onTick = function(ratio) {
                roundCirc.clear();
                drawRoundCirc(1, 0x000000, 0.8);
                drawRoundCirc(ratio, 0xffff00, 0.6);
            };

            this.add(this.roundTimer);


            // Combo time meter
            this.comboTimeBar = new ui.StatusBar(res.slices.barBack, res.slices.barFront, 200, 13);
            this.comboTimeBar.x = gfx.width/2 - this.comboTimeBar.width/2;
            this.comboTimeBar.depth = gfx.layers.gui;
            this.comboTimeBar.setRatio(0);
            this.add(this.comboTimeBar);


            // Combo and status text (currently xp).
            this.statusText = this.addDisplay(new gfx.pixi.Text('', commonTextStyle));
            this.comboText = this.addDisplay(new gfx.pixi.Text('', commonTextStyle));
            this.comboText.anchor.x = 0.5;
            this.comboText.position.x = gfx.width/2;
            this.comboText.position.y = this.comboTimeBar.height;
            this.statusText.depth = gfx.layers.gui;
            this.comboText.depth = gfx.layers.gui;


            this.roundTimerEndText = new gfx.pixi.Text('Pop the remaining bubbles!', {
                fill: 'white',
                font: 'bold 16px arial',
            });
            this.roundTimerEndText.depth = gfx.layers.gui;
            this.roundTimerEndText.x = gfx.width/2 - this.roundTimerEndText.width/2;
            this.roundTimerEndText.y = gfx.height - this.roundTimerEndText.height-5;

            // Sprite Batches

            this.bulletBatch = new gfx.pixi.SpriteBatch();
            this.bubbleBatch = new gfx.pixi.SpriteBatch();
            this.glareBatch = new gfx.pixi.SpriteBatch();
            this.armorBatch = new gfx.pixi.SpriteBatch();

            this.bubbleBatch.depth = gfx.layers.bubbles;
            this.glareBatch.depth = gfx.layers.bubble-1;

            this.addDisplay(this.bulletBatch);
            this.addDisplay(this.bubbleBatch);
            this.addDisplay(this.glareBatch);
            this.addDisplay(this.armorBatch);

            // Particle Emitters

            this.pinEmitter = new objects.Emitter(res.tex.pinParticle, {
                angleMin: 0,
                angleMax: 360,
                speedMin: 0.1,
                speedMax: 0.2,
                lifeMin: 50,
                lifeMax: 100,
                range: 3,
                minRotationRate: 0.2,
                maxRotationRate: 0.5,
            });
            this.add(this.pinEmitter);

            this.bubbleEmitter = new objects.Emitter(res.tex.bubbleParticle, {
                angleMin: 0,
                angleMax: 360,
                speedMin: 0.01,
                speedMax: 0.08,
                lifeMin: 20,
                lifeMax: 40,
                range: 4,
                minRotationRate: 0,
                maxRotationRate: 0,
            });
            this.add(this.bubbleEmitter);

/*            var i;
            for (i=0; i<0; ++i) {
                this.add(randBub(8));
            }

            for (i=0; i<40; i++) {
                this.add(randBub(3));
            }*/


            // Need to bind event callbacks, otherwise `this === window` on call
            _.bindAll(this, 'onBlur', 'onFocus');
            this._addEventListeners();
        };

        Field.prototype.update = function(delta) {
            State.prototype.update.call(this, delta);

            this.statusText.setText('XP: ' + this.xp);

            this.updateCombo(delta);

            if (this.currentQuest.completed) {
                if (!this.skipDay) {
                    this.timeBonus = this.roundTimer.currentTime / this.roundTimer.duration;

                    var skipDayButton = new ui.Button('End Day', {}, function() {
                        setState(new RoundCompleteMenu(null, this));
                    }, this);
                    skipDayButton.x = gfx.width - skipDayButton.width - 16;
                    skipDayButton.y = 100;
                    skipDayButton.depth = gfx.layers.gui;
                    this.add(skipDayButton);
                    this.skipDay = true;
                }
            }

            if (this.roundTimerComplete) {
                if (this.bubbles.length <= 0) {
                    this.pause(RoundEndPauseMenu);
                }
            }

            this.monitorHotkeys(this.hotkeys);
        };

        Field.prototype.updateCombo = function(delta) {
            this.comboText.setText(this.combo + ' / ' + this.comboGoal
            + '\nx' + this.multiplier);

            // Once the combo counter has reached the combo goal we want to increment the multiplier and increase the combo goal. The multiplier should only be increased here.
            if (this.combo >= this.comboGoal) {
                this.multiplier++;

                quests.updateObjective('multiplier', {multiplier: this.multiplier});

                this.comboGoal = this.comboGoal + Math.round(Math.sqrt(this.comboGoal * 8));
            }

            if (this.combo > 0) {
                this.comboTimer -= delta;
                this.comboTimeBar.setRatio(this.comboTimer / this.comboTime);
                if (this.comboTimer < 0) {
                    this.combo = 0;
                    this.comboGoal = 4;
                    this.multiplier = 1;
                }
            }
        };

        Field.prototype.monitorHotkeys = function(hotkeys) {
            if (!(hotkeys.menus && hotkeys.weapons))
                throw new TypeError('Field.monitorHotkeys: Invalid hotkey format passed');
            // Listen for menu hotkeys and set closeKeys on instantiated menu
            // Menu hotkeys are weird - see the comments in the constructor
            mkeys = hotkeys.menus;
            for (var i = 0; i < mkeys.length; i++) {
                if (_.isFunction(mkeys[i][0]) && input.key.isReleased(mkeys[i][1])) {
                    var m = new mkeys[i][0](this);
                    this.pause(m);
                    // set the close button to the button used for opening
                    m.closeKeys = mkeys[i][1];
                }
            }

            // Weapon Hotkeys - typically pulled straight from bpm.hotkeys.weapons
            _.each(hotkeys.weapons, _.bind(function(keys, weapon) {
                var className;
                if (_.isString(weapon))
                    className = weapon;
                else if (weapon instanceof objects.Weapon)
                    className = weapon.constructor.name;
                else
                    throw new TypeError('Field.monitorHotkeys: Invalid weapon passed anonymous function');

                if (input.key.isReleased(keys) && className !== this.currentWeapon.className)
                    this.setWeapon(weapon);
            }, this));

            // Actions are a bit different, as we are not instantiating a class
            // Define actions in an obj {'NameOfAction': function() {}}
            var actions = {
                // Spawns 10 bubbles (for testing)
                'SpawnBubbles': _.bind(function() {
                    _(10).times(_.bind(function() {
                        this.add(new objects.Bubble(3, randomRange(32, gfx.width-32), randomRange(-32, gfx.height / 4), Math.random() * 360));
                    }, this));
                }, this),
                'Reset': _.bind(function() {
                    setState(new Field());
                }, this)
            };

            _.each(hotkeys.actions, _.bind(function(key, action) {
                if (input.key.isReleased(key)) {
                    if (_(actions).has(action) && _(actions[action]).isFunction()) {
                        actions[action]();
                    }
                }
            }, this));
        };

        Field.prototype.destroy = function() {
            State.prototype.destroy.call(this);
            this._removeEventListeners();
        };

        /*
           Sets weapon; updates all global and instance references and adds to state (self)
            input: weapon - instanceof Weapon OR Case Sensitive String of weapon class name
            output: instanceof Weapon
        */
        Field.prototype.setWeapon = function(weapon) {
            // Accepts a string or instanceof Weapon
            var weaponName;
            if (_.isString(weapon))
                weaponName = weapon;
            else if (weapon instanceof objects.Weapon)
                weaponName = weapon.className;
            else
                throw new TypeError('Field.setWeapon: Incorrect weapon type passed');

            // Prevent switching to the same weapon, creating multiple instances of the weapon
            if (weaponName === (this.currentWeapon && this.currentWeapon.className))
                return this.currentWeapon;

            // Restore weapon if there is a saved version
            // otherwise instantiate a new one
            if (this.savedWeapons && this.savedWeapons[weaponName]) {
                weapon = this.savedWeapons[weaponName];
                this.savedWeapons[weaponName] = null;
            } else if (_.isFunction(objects[weaponName])) {
                weapon = new objects[weapon]();
            }

            // Add the current weapon to the list of saved weapons
            // This will keep the ammo timer going in the background
            if (this.currentWeapon) {
                this.savedWeapons[this.currentWeapon.className] = this.currentWeapon;
                this.remove(this.currentWeapon);
            }

            bpm.player.currentWeapon = weaponName;
            this.currentWeapon = weapon;

            var cursors = {
                'Shotgun': res.tex.cursorShotgun,
                'PinShooter': res.tex.cursorCannon,
                'Rifle': res.tex.cursorRifle
            };

            for (var key in cursors) {
                if (weaponName === key) {
                    this.setCursor(cursors[key]);
                    break;
                }
            }

            return this.add(weapon);
        };

        Field.prototype.onPause = function() {
            this._removeEventListeners();
        };

        Field.prototype.onRestore = function() {
            this._addEventListeners();
        };

        Field.prototype.onBlur = function() {
            // Pause game when window loses focus
            this.pause(FieldPauseMenu);
        };

        Field.prototype.onFocus = function() {
        };

        Field.prototype._addEventListeners = function() {
            window.addEventListener('blur', this.onBlur);
            window.addEventListener('focus', this.onFocus);
        };

        Field.prototype._removeEventListeners = function() {
            window.removeEventListener('blur', this.onBlur);
            window.removeEventListener('focus', this.onFocus);
        };


    var Menu = function(prevState) {
        State.call(this);
        this.prevState = prevState;
        if (this.prevState instanceof Menu) {
            this.prevMenu = this.prevState;
        } else if (this.prevState instanceof State) {
            this.cachedState = this.prevState;
        }
        this.buttonStyle = {
            font: 'bold 24px arial'
        };
    };
        Menu.prototype = Object.create(State.prototype);
        Menu.prototype.constructor = State;

        Menu.prototype.init = function() {
            State.prototype.init.call(this);
        };

        Menu.prototype.update = function(delta) {
            State.prototype.update.call(this, delta);
            if (this.closeKeys) {
                if (input.key.isReleased(this.closeKeys))
                    this.close();
            }
        };

        Menu.prototype.close = function() {
            setState(this.prevState, { initNew: false });
            this.prevState.paused = false;
            this.prevState.onRestore();
        };


    // TODO: Put options in here vv
    var FieldPauseMenu = function(prevState) {
        Menu.call(this, prevState);
    };
        FieldPauseMenu.prototype = Object.create(Menu.prototype);
        FieldPauseMenu.prototype.constructor = FieldPauseMenu;

        FieldPauseMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            var back = new gfx.pixi.Graphics();
            back.beginFill('0', 0.5);
            back.drawRect(0, 0, gfx.width, gfx.height);
            back.endFill();

            var text = new gfx.pixi.Text('Paused\nMIDDLE CLICK', {
                stroke: 'black',
                strokeThickness: 8,
                align: 'center',
                fill: 'white',
                font: 'bold 64px arial',
            });

            text.anchor.x = text.anchor.y = 0.5;
            text.x = gfx.width/2;
            text.y = gfx.height/2;

            this.addDisplay(back);
            this.addDisplay(text);
        };

        FieldPauseMenu.prototype.update = function(delta) {
            Menu.prototype.update.call(this, delta);

            if (input.mouse.isReleased(input.MOUSE_MIDDLE)) {
                setState(new AnotherPauseMenu(this));
            }

            if (input.mouse.isPressed(input.MOUSE_LEFT)) {
                this.close();
            }
        };

    var AnotherPauseMenu = function(prevState) {
        Menu.call(this, prevState);
    };
        AnotherPauseMenu.prototype = Object.create(Menu.prototype);
        AnotherPauseMenu.prototype.constructor = AnotherPauseMenu;

        AnotherPauseMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            var back = new gfx.pixi.Graphics();
            back.beginFill('0', 0.5);
            back.drawRect(0, 0, gfx.width, gfx.height);
            back.endFill();

            var text = new gfx.pixi.Text('Another Menu!!!\nMIDDLE CLICK', {
                stroke: 'black',
                strokeThickness: 8,
                align: 'center',
                fill: 'white',
                font: 'bold 64px arial',
            });

            text.anchor.x = text.anchor.y = 0.5;
            text.x = gfx.width/2;
            text.y = gfx.height/2;

            this.addDisplay(back);
            this.addDisplay(text);
        };

        AnotherPauseMenu.prototype.update = function(delta) {
            Menu.prototype.update.call(this, delta);
            if (input.mouse.isReleased(input.MOUSE_MIDDLE)) {
                this.close();
            }
        };

    var RoundEndPauseMenu = function(prevState) {
        Menu.call(this, prevState);
    };
        RoundEndPauseMenu.prototype = Object.create(Menu.prototype);
        RoundEndPauseMenu.prototype.constructor = RoundEndPauseMenu;

        RoundEndPauseMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            var back = new gfx.pixi.Graphics();
            back.beginFill('0', 0.5);
            back.drawRect(0, 0, gfx.width, gfx.height);
            back.endFill();
            back.depth = gfx.layers.gui-10;
            this.addDisplay(back);

            var text = new gfx.pixi.Text('Day completed!', {
                stroke: 'black',
                strokeThickness: 8,
                align: 'center',
                fill: 'white',
                font: 'bold 64px arial'
            });
            text.depth = back.depth - 1;
            text.anchor.x = text.anchor.y = 0.5;
            text.x = gfx.width/2;
            text.y = gfx.height/2;
            this.addDisplay(text);

            var button = new ui.Button('Continue', this.buttonStyle, function() {
                this.prevState.destroy();
                setState(new RoundCompleteMenu(null, this.prevState));
            }, this);
            button.x = gfx.width/2 - button.width/2;
            button.y = text.y + text.height;
            button.up.depth = back.depth - 1;
            button.down.depth = button.up.depth;
            button.displayText.depth = button.up.depth-1;
            this.add(button);
        };

    var MainMenu = function(prevState) {
        Menu.call(this, prevState);
    };
        MainMenu.prototype = Object.create(Menu.prototype);
        MainMenu.prototype.constructor = MainMenu;

        MainMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            this.buttons = {
                start: new ui.Button('Start', this.buttonStyle, function() { setState(new TownMenu()); }, this),
            }

            this.buttons.start.setUiPos(gfx.width / 2 - 5, gfx.height / 2);

            this.add(_.values(this.buttons));
        };

    var TabMenu = function(prevState) {
        Menu.call(this, prevState);
    };
        TabMenu.prototype = Object.create(Menu.prototype);
        TabMenu.prototype.constructor = TabMenu;

        TabMenu.prototype.currentTab = null;

        TabMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            this.tabs = [];

            this.addTab('Town', TownMenu);
            this.addTab('Blacksmith', SmithMenu);
            this.addTab('Wizard', WizardMenu);
        };

        TabMenu.prototype.close = function() {
            Menu.prototype.close.call(this);
        };

        TabMenu.prototype.addTab = function(name, State) {
            var newTab = new ui.Button(name, this.buttonStyle, function() {
                if (name !== TabMenu.prototype.currentTab) {
                    TabMenu.prototype.currentTab = name;
                    setState(new State());
                }
            }, this);

            this.tabs.push(newTab);

            var index = this.tabs.indexOf(newTab);
            var prevTab = index > 0 ? this.tabs[index-1] : null;

            if (prevTab) {
                newTab.x = prevTab.x + prevTab.width + 32;
            }

            this.add(newTab);
        };

    var TownMenu = function(prevState) {
        TabMenu.call(this, prevState);
    };
        TownMenu.prototype = Object.create(TabMenu.prototype);
        TownMenu.prototype.constructor = TownMenu;

        TownMenu.prototype.init = function() {
            TabMenu.prototype.init.call(this);

            var questDescription = new ui.TextField('', gfx.width/2, 64, gfx.width/2-32, gfx.height - 160);
            this.add(questDescription);

            var dayText = new gfx.pixi.Text('Day ' + bpm.player.day, {fill: 'white'});
            dayText.x = gfx.width - dayText.width - 10;
            dayText.y = 10;
            this.addDisplay(dayText);

            // If this is a pause menu for Field then display current quest status rather than round selection.
            if (this.cachedState) {
                this.cachedState.displayObjectContainer.visible = false;

                // Since there's a cached state we assume Field has been paused which must mean there's a current quest. So we display the status of each objective.
                var description = '';
                for (var i in bpm.player.currentQuest.objectives) {
                    var obj = bpm.player.currentQuest.objectives[i];

                    if (_.isEmpty(obj.description)) continue;

                    description += '\n';

                    if (obj.completed) {
                        description += 'Complete - ';
                    }

                    if (obj.genStatus) {
                        description += obj.genStatus(obj.status);
                    } else {
                        description += obj.description;
                    }
                }

                questDescription.text = bpm.player.currentQuest.description + description;

                var continueButton = new ui.Button('Continue', this.buttonStyle, function() {
                    this.close();
                }, this);

                continueButton.x = gfx.width - continueButton.width - 10;
                continueButton.y = gfx.height - continueButton.height - 10;

                var endDayButton = new ui.Button(bpm.player.currentQuest.completed ? 'End Day' : 'Abandon Quest', this.buttonStyle, function() {
                    setState(new RoundCompleteMenu(null, this.cachedState));
                }, this);

                endDayButton.x = continueButton.x - endDayButton.width - 20;
                endDayButton.y = gfx.height - endDayButton.height - 10;

                this.add([continueButton, endDayButton]);

                for (var i=0; i<this.tabs.length; ++i) {
                    this.tabs[i].disable();
                }
            } else { // This is not a pause menu for Field so we treat it as a round selector.
                var selectedButton = null;
                var selectedButtonText = '';
                for (var i=0; i<bpm.player.quests.length; ++i) {
                    var quest = quests.all[bpm.player.quests[i]];

                    // Pretty ugly. Binds 'this' to an anonymous function.
                    (_.bind(function(quest) {
                        var qButton = new ui.Button(quest.name, this.buttonStyle);

                        qButton.onRelease = _.bind(function() {
                            if (this.selectedQuest === quest) {
                                if (this.selectedQuest) {
                                    bpm.player.currentQuest = this.selectedQuest;
                                    setState(new Field());
                                } else {
                                    console.log('Please select a quest');
                                }
                            } else {
                                if (selectedButton) {
                                    selectedButton.displayText.setText(selectedButtonText);
                                }
                                selectedButton = qButton;
                                selectedButtonText = qButton.displayText.text;
                                qButton.displayText.setText('Start');
                                this.selectedQuest = quest;
                            }

                            var description = quest.description;

                            for (var key in quest.objectives) {
                                description += '\n' + quest.objectives[key].description;
                            }

                            questDescription.text = description;
                        }, this);

                        qButton.x = 32;
                        qButton.y = 100 + ((qButton.height+10) * i);
                        this.add(qButton);
                    }, this))(quest);
                }
            }
        };

        TownMenu.prototype.close = function() {
            TabMenu.prototype.close.call(this);
            if (this.cachedState) {
                this.cachedState.displayObjectContainer.visible = true;
            }
        };

    var SmithMenu = function(prevState) {
        TabMenu.call(this, prevState);
        this.selectedUpgrade;
        this.selectedWeapon;
        this.tab = 'general';
        this.tabObjects = [];
    };
        SmithMenu.prototype = Object.create(TabMenu.prototype);
        SmithMenu.prototype.constructor = SmithMenu;

        SmithMenu.prototype.init = function() {
            TabMenu.prototype.init.call(this);

            this.moneyText = new gfx.pixi.Text('$' + bpm.player.money, {fill: 'white'});
            this.moneyText.x = gfx.width - this.moneyText.width - 10;
            this.moneyText.y = 10;
            this.addDisplay(this.moneyText);

            var onTabSwitch = _.bind(function() {
                this.remove(this.tabObjects);
                this.tabObjects = [];
                this.selectedUpgrade = null;
                this.selectedWeapon = null;
            }, this);

            var generalTab = new ui.Button('General', this.buttonStyle, function() {
                if (this.tab !== 'general') {
                    this.tab = 'general';
                    onTabSwitch();
                    this.addGeneralContent();
                }
            }, this);
            var weaponTab = new ui.Button('Weapons', this.buttonStyle, function() {
                if (this.tab !== 'weapons') {
                    this.tab = 'weapons';
                    onTabSwitch();
                    this.addWeaponContent();
                }
            }, this);

            generalTab.x = 16;
            generalTab.y = 50;
            weaponTab.x = generalTab.x + weaponTab.width;
            weaponTab.y = 50;
            this.add([generalTab, weaponTab]);

            this.addGeneralContent();

            this.purchaseButton = new ui.Button('upgrade', this.buttonStyle, function() {
                if (!this.selectedUpgrade) return;

                this.selectedUpgrade.purchase(bpm.player);

                this.updateDescription(this.selectedUpgrade);
                var purchasedText = this.add(new ui.FloatText('Purchased'));
                purchasedText.x = this.purchaseButton.x + purchasedText.displayText.width/2;
                purchasedText.y = this.purchaseButton.y - purchasedText.displayText.height/2;

            }, this);

            // tmp
            var refundButton = new ui.Button('downgrade', this.buttonStyle, function() {
                if (!this.selectedUpgrade) return;
                if (this.selectedUpgrade.levelNum > 0) {
                    this.selectedUpgrade.setLevel(this.selectedUpgrade.levelNum-1);
                    if (this.selectedWeapon) {
                        if (_.isEmpty(bpm.player.upgrades.weapons[this.selectedWeapon])) {
                            bpm.player.upgrades.weapons[this.selectedWeapon] = {};
                        }

                        // Reusing since this probably won't be here in the final version.
                        bpm.player.upgrades.weapons[this.selectedWeapon][this.selectedUpgrade.id] = this.selectedUpgrade.levelNum;
                    } else {
                        bpm.player.upgrades.general[this.selectedUpgrade.id] = this.selectedUpgrade.levelNum;
                    }
                    this.updateDescription(this.selectedUpgrade);
                }
            }, this);
            this.add([this.purchaseButton, refundButton]);

            this.purchaseButton.setUiPos(gfx.width - this.purchaseButton.width - 5, gfx.height - 50);
            refundButton.setUiPos(this.purchaseButton.x - refundButton.width - 32, gfx.height - 50);
        };

        SmithMenu.prototype.updateDescription = function(upgrade) {
            var nextLevel = upgrade.getNextLevel();
            this.upgradeDescription.text = upgrade.name + '\n' + upgrade.description;

            this.purchaseButton.enable();

            this.moneyText.setText('$' + bpm.player.money);
            this.moneyText.x = gfx.width - this.moneyText.width - 10;

            var requires = upgrade.getRequirements(bpm.player);

            if (requires) {
                this.purchaseButton.disable();
                if (requires.notMaxed) {
                    this.upgradeDescription.text += '\nMaxed';
                }
            }

            if (!upgrade.isMaxed()) {
                for (var key in nextLevel) {
                    var ability = upgrades.abilities[key];
                    if (ability) {
                        if (ability.hasDescription) {
                            this.upgradeDescription.text += '\n' + ability.genDescription(nextLevel[key]);
                        }
                    }
                }
                this.upgradeDescription.text += '\n$' + (nextLevel ? nextLevel.cost : 0);
            }

            this.upgradeDescription.text += '\n' + upgrade.levelNum + ' / ' + upgrade.length;

            if (requires) {
                if (requires.currency) {
                    this.upgradeDescription.text += '\nInsufficient funds';
                }

                if (requires.upgrades) {
                    var txt = '\nRequires ';
                    for (var i=0; i<requires.upgrades.length; ++i) {
                        var requiredUpgrade = requires.upgrades[i];
                        var last = i+1 >= requires.upgrades.length;
                        txt += upgrades.weapons[this.selectedWeapon][requiredUpgrade].name +  (last ? '' : ', ');
                    }
                    this.upgradeDescription.text += txt;
                }

                if (requires.points) {
                    this.upgradeDescription.text += '\nRequires ' + requires.points + ' spent points.';
                }
            }

        };

        SmithMenu.prototype.addGeneralContent = function() {
            this.upgradeDescription = new ui.TextField('', gfx.width/2, 64, gfx.width/2-32, gfx.height - 160);
            this.tabObjects.push(this.upgradeDescription);

            for (var i=0; i<upgrades.general.length; ++i) {
                var upgrade = upgrades.general[i];

                var newButton;
                (_.bind(function(upgrade) {
                    newButton = new ui.Button(upgrade.name, this.buttonStyle, function() {
                        this.selectedUpgrade = upgrade;
                        this.updateDescription(this.selectedUpgrade);
                    }, this);
                }, this))(upgrade);

                newButton.setUiPos(50, 100 + 50 * i);
                this.tabObjects.push(newButton);
            }

            this.add(this.tabObjects);
        };

        SmithMenu.prototype.addWeaponContent = function() {
            var upgradeButtons = [];
            var weaponButtons = [];

            this.upgradeDescription = new ui.TextField('', 16, 200, gfx.width/2-32, gfx.height - 250);
            this.tabObjects.push(this.upgradeDescription);

            for (var key in upgrades.weapons) {
                // Add a button for every weapon.
                _.bind((function(weapon) {
                    var weaponButton = new ui.Button(weapon, this.buttonStyle, function() {
                        this.selectedWeapon = weapon;

                        // Remove previous upgrade buttons before adding more.
                        for (var i=0; i<upgradeButtons.length; ++i) {
                            this.remove(upgradeButtons[i]);
                        }

                        // Add the upgrades for each weapon.
                        var upgradeList = upgrades.weapons[weapon];
                        for (var i=0; i<upgradeList.length; ++i) {
                            var upgrade = upgradeList[i];

                            var button;
                            (_.bind(function(upgrade) {
                                button = new ui.Button(upgrade.name, this.buttonStyle, function() {
                                    this.selectedUpgrade = upgrade; // Make sure to clear this every tab switch.
                                    this.updateDescription(this.selectedUpgrade);
                                }, this);
                            }, this))(upgrade);

                            button.setUiPos(gfx.width/2, 100 + 50 * i);
                            upgradeButtons.push(button);
                            this.tabObjects.push(button);
                            this.add(button);
                        }
                    }, this);

                    weaponButtons.push(weaponButton);
                }), this)(key);
            }

            _.each(weaponButtons, function(b, i) {
                b.setUiPos(50, 100 + 50 * i);
                this.tabObjects.push(b);
            }, this);

            this.add(this.tabObjects);
        };

    var WizardMenu = function(prevState) {
        TabMenu.call(this, prevState);
        this.selectedUpgrade;
        this.selectedElement;
        this.tab = 'perks';
        this.tabObjects = [];
    };
        WizardMenu.prototype = Object.create(TabMenu.prototype);
        WizardMenu.prototype.constructor = WizardMenu;

        WizardMenu.prototype.init = function() {
            TabMenu.prototype.init.call(this);

            var commonText = {
                stroke: 'black', fill: 'white',
                strokeThickness: 4,
                font: '24px arial',
            };

            this.pointText = this.addDisplay( new gfx.pixi.Text(bpm.player.levelPoints + ' points', commonText) );
            this.pointText.x = gfx.width - this.pointText.width - 10;
            this.pointText.y = 10;

            var xpMeter = this.add( new ui.StatusBar(res.slices.barBack, res.slices.barFront, 200, 13) );
            xpMeter.x = gfx.width/2;
            xpMeter.setRatio(bpm.player.xp / bpm.getXpGoal(bpm.player.level));

            var currentLevelText = this.addDisplay( new gfx.pixi.Text(bpm.player.level, commonText) );
            currentLevelText.x = gfx.width/2 - currentLevelText.width/2 - 5;

            var newLevelText = this.addDisplay( new gfx.pixi.Text(bpm.player.level+1, commonText) );
            newLevelText.x = xpMeter.x + xpMeter.width + newLevelText.width/2;

            var xpText = this.addDisplay( new gfx.pixi.Text(bpm.player.xp + ' / ' + bpm.getXpGoal(bpm.player.level), _.defaults({
                font: '18px arial',
            }, commonText)) );
            xpText.x = xpMeter.x + xpMeter.width/2 - xpText.width/2;
            xpText.y = xpMeter.y + xpMeter.height;

            var onTabSwitch = _.bind(function() {
                this.remove(this.tabObjects);
                this.tabObjects = [];
                this.selectedUpgrade = null;
                this.selectedElement = null;
            }, this);

            var perksTab = new ui.Button('Perks', this.buttonStyle, function() {
                if (this.tab !== 'perks') {
                    this.tab = 'perks';
                    onTabSwitch();
                    this.addPerkContent();
                }
            }, this);
            var elementTab = new ui.Button('Elements', this.buttonStyle, function() {
                if (this.tab !== 'elements') {
                    this.tab = 'elements';
                    onTabSwitch();
                    this.addElementContent();
                }
            }, this);

            perksTab.x = 16;
            perksTab.y = 50;
            elementTab.x = perksTab.x + elementTab.width;
            elementTab.y = 50;
            this.add([perksTab, elementTab]);

            this.addPerkContent();

            this.purchaseButton = new ui.Button('upgrade', this.buttonStyle, function() {
                if (!this.selectedUpgrade) return;

                this.selectedUpgrade.purchase(bpm.player);

                this.updateDescription(this.selectedUpgrade);
            }, this);

            // tmp
            var refundButton = new ui.Button('downgrade', this.buttonStyle, function() {
                if (!this.selectedUpgrade) return;
                if (this.selectedUpgrade.levelNum > 0) {
                    this.selectedUpgrade.setLevel(this.selectedUpgrade.levelNum-1);
                    if (this.selectedElement) {
                        if (_.isEmpty(bpm.player.upgrades.elements[this.selectedElement])) {
                            bpm.player.upgrades.elements[this.selectedElement] = {};
                        }

                        // Reusing since this probably won't be here in the final version.
                        bpm.player.upgrades.elements[this.selectedElement][this.selectedUpgrade.id] = this.selectedUpgrade.levelNum;
                    } else {
                        bpm.player.upgrades.perks[this.selectedUpgrade.id] = this.selectedUpgrade.levelNum;
                    }
                    this.updateDescription(this.selectedUpgrade);
                }
            }, this);
            this.add([this.purchaseButton, refundButton]);

            this.purchaseButton.setUiPos(gfx.width - this.purchaseButton.width - 5, gfx.height - 50);
            refundButton.setUiPos(this.purchaseButton.x - refundButton.width - 32, gfx.height - 50);
        };

        WizardMenu.prototype.updateDescription = function(upgrade) {
            var nextLevel = upgrade.getNextLevel();
            this.upgradeDescription.text = upgrade.name + '\n' + upgrade.description;

            this.pointText.setText(bpm.player.levelPoints + ' points');
            this.pointText.x = gfx.width - this.pointText.width - 10;

            this.purchaseButton.enable();

            if (upgrade.isMaxed()) {
                this.upgradeDescription.text += '\nMaxed';
                this.purchaseButton.disable();
            } else {
                for (var key in nextLevel) {
                    var ability = upgrades.abilities[key];
                    if (ability) {
                        if (ability.hasDescription) {
                            this.upgradeDescription.text += '\n' + ability.genDescription(nextLevel[key]);
                        }
                    }
                }
                this.upgradeDescription.text += '\n$' + (nextLevel ? nextLevel.cost : 0);
            }

            this.upgradeDescription.text += '\n' + upgrade.levelNum + ' / ' + upgrade.length;

            if (nextLevel && bpm.player.levelPoints < nextLevel.cost) {
                this.upgradeDescription.text += '\nInsufficient points';
                this.purchaseButton.disable();
            }

            if (this.selectedElement) {
                var playerElementUpgrades = bpm.player.upgrades.elements[this.selectedElement] || {};

                if (upgrade.requiredUpgrades) {
                    var txt = '\nRequires ';
                    var requireFound = false;

                    for (var i=0; i<upgrade.requiredUpgrades.length; ++i) {
                        var requiredUpgrade = upgrade.requiredUpgrades[i];
                        var last = i+1 >= upgrade.requiredUpgrades.length;

                        if (!_(playerElementUpgrades).has(requiredUpgrade)) {
                            txt += upgrades.elements[this.selectedElement][requiredUpgrade].name +  (last ? '' : ', ');
                            requireFound = true;
                        }
                    }

                    if (requireFound) {
                        this.purchaseButton.disable();
                        this.upgradeDescription.text += txt;
                    }
                }

                if (upgrade.requiredPoints) {
                    var points = 0;

                    for (var id in playerElementUpgrades) {
                        points += playerElementUpgrades[id];
                    }

                    if (points < upgrade.requiredPoints) {
                        this.upgradeDescription.text += '\nRequires ' + upgrade.requiredPoints + ' spent points.';
                        this.purchaseButton.disable();
                    }
                }
            }
        };

        WizardMenu.prototype.addPerkContent = function() {
            this.upgradeDescription = new ui.TextField('', gfx.width/2, 64, gfx.width/2-32, gfx.height - 160);
            this.tabObjects.push(this.upgradeDescription);

            for (var i=0; i<upgrades.perks.length; ++i) {
                var upgrade = upgrades.perks[i];

                var newButton;
                (_.bind(function(upgrade) {
                    newButton = new ui.Button(upgrade.name, this.buttonStyle, function() {
                        this.selectedUpgrade = upgrade;
                        this.updateDescription(this.selectedUpgrade);
                    }, this);
                }, this))(upgrade);

                newButton.setUiPos(50, 100 + 50 * i);
                this.tabObjects.push(newButton);
            }

            this.add(this.tabObjects);
        };

        WizardMenu.prototype.addElementContent = function() {
            var upgradeButtons = [];
            var elementButtons = [];

            this.upgradeDescription = new ui.TextField('', 16, 250, gfx.width-32, gfx.height - 300);
            this.tabObjects.push(this.upgradeDescription);

            for (var key in upgrades.elements) {
                // Add a button for every element.
                _.bind((function(element) {
                    var elementButton = new ui.Button(element, this.buttonStyle, function() {
                        this.selectedElement = element;

                        // Remove previous upgrade buttons before adding more.
                        for (var i=0; i<upgradeButtons.length; ++i) {
                            this.remove(upgradeButtons[i]);
                        }

                        // Add the upgrades for each element.
                        var upgradeList = upgrades.elements[element];
                        for (var i=0; i<upgradeList.length; ++i) {
                            var upgrade = upgradeList[i];

                            var button;
                            (_.bind(function(upgrade) {
                                button = new ui.Button(upgrade.name, this.buttonStyle, function() {
                                    this.selectedUpgrade = upgrade; // Make sure to clear this every tab switch.
                                    this.updateDescription(this.selectedUpgrade);
                                }, this);
                            }, this))(upgrade);

                            button.setUiPos(gfx.width/2, 60 + 50 * i);
                            upgradeButtons.push(button);
                            this.tabObjects.push(button);
                            this.add(button);
                        }
                    }, this);

                    elementButtons.push(elementButton);
                }), this)(key);
            }

            _.each(elementButtons, function(b, i) {
                b.setUiPos(50, 100 + 50 * i);
                this.tabObjects.push(b);
            }, this);

            this.add(this.tabObjects);
        };

    var RoundCompleteMenu = function(prevState, field) {
        Menu.call(this, prevState);
        this.field = field;
        this.timeBonus = this.field.timeBonus;
        this.quest = this.field.currentQuest;
    };
        RoundCompleteMenu.prototype = Object.create(Menu.prototype);
        RoundCompleteMenu.prototype.constructor = RoundCompleteMenu;

        RoundCompleteMenu.prototype.init = function() {
            Menu.prototype.init.call(this);

            this.addDisplay(new gfx.pixi.Text('Day complete!', {
                stroke: 'black',
                strokeThickness: 4,
                fill: 'white',
                align: 'left',
            }));

            var rawXp = this.field.xp;
            var totalXp = rawXp;

            var xpBonus = 0;
            if (this.quest.bonus) {
                xpBonus = Math.round(this.quest.bonus * this.timeBonus);
                if (xpBonus > 0) {
                    totalXp += xpBonus;
                }
            }

            // Abandoning a quest will have the same affect as failing.
            if (!this.quest.completed) {
                var reducePercent = 0.5;
                totalXp *= reducePercent;
            }

            bpm.player.day++;
            bpm.player.xp += totalXp;

            var leveledUp = false;
            var startLevel = bpm.player.level;
            while (bpm.player.xp >= bpm.getXpGoal(bpm.player.level)) {
                bpm.player.level++;
                bpm.player.levelPoints++;
                leveledUp = true;
            }

            if (leveledUp) {
                var levelText = new gfx.pixi.Text('Level up!\n' + startLevel + ' -> ' + bpm.player.level, {
                    stroke: 'black',
                    strokeThickness: 4,
                    fill: 'white',
                    align: 'center',
                });

                levelText.x = 450;
                levelText.y = 450;
                this.addDisplay(levelText);
            }

            var xpText = new gfx.pixi.Text('Experience earned: ' + rawXp +
            (reducePercent ? '\nFailure penalty: -' + reducePercent*100 + '%': '') +
            (xpBonus > 0 ? '\nTime bonus: ' + xpBonus : '') +
            "\nToday's experience: " + totalXp +
            '\nTotal experience: ' + bpm.player.xp, {
                stroke: 'black',
                strokeThickness: 4,
                fill: 'white',
                align: 'left',
            });

            xpText.x = 50;
            xpText.y = 400;
            this.addDisplay(xpText);

            var button = new ui.Button('Continue', this.buttonStyle, function() {
                setState(new TownMenu());
            });
            button.x = gfx.width - button.width - 10;
            button.y = gfx.height - button.height - 10;
            this.add(button);

            // Quest status

            var quest = this.field.currentQuest;

            var completeText = new gfx.pixi.Text('Failed', {
                stroke: 'black',
                strokeThickness: 4,
                fill: 'white',
                align: 'center',
            });

            var questText = new gfx.pixi.Text(quest.name, {
                stroke: 'black',
                strokeThickness: 4,
                fill: 'white',
                align: 'center',
                font: 'bold 64px arial',
            });

            if (quest.completed) {
                bpm.player.money += quest.reward;
                completeText.setText('Completed\n$' + quest.reward + ' reward\n$' + bpm.player.money + ' total');

                // Remove the current quest from available quests.
                bpm.player.quests.splice(bpm.player.quests.indexOf(quest.id), 1);

                // Unlock new quests adding them to available quests.
                if (quest.unlocks) {
                    for (var i=0; i<quest.unlocks.length; ++i) {
                        bpm.player.quests.push(quest.unlocks[i]);
                    }
                }

                bpm.player.quests.sort(quests.idComparator);
                bpm.player.currentQuest = null;
            } else {
                var text = 'Failed';
                for (var key in quest.objectives) {
                    var objective = quest.objectives[key];

                    text += '\n' +
                        (objective.completed ? 'Completed - ' : 'Failed - ') +
                        (quest.objectives[key].description);
                }
                completeText.setText(text);
            }

            completeText.anchor.x = 0.5;

            questText.x = gfx.width/2 - questText.width/2;
            questText.y = 100;

            completeText.x = gfx.width/2;
            completeText.y = questText.y + questText.height + 5;

            this.addDisplay(questText);
            this.addDisplay(completeText);
        };

    var CutsceneState = function(prevState, cutsceneName) {
        Menu.call(this, prevState);
        this.phaseIndex = -1; // Current phase index
        this.phases = CutsceneState.cutscenes[cutsceneName];
        if (_.isUndefined(this.phases)) {
            console.error("The cutscene '" + cutsceneName + "' does not exist.");
        }
    };
        CutsceneState.parseCutscenes = function(jsonString) { CutsceneState.cutscenes = JSON.parse(jsonString); };
        CutsceneState.prototype = Object.create(Menu.prototype);
        CutsceneState.prototype.constructor = CutsceneState;

        CutsceneState.prototype.init = function() {
            Menu.prototype.init.call(this);

            this.background = new gfx.pixi.Graphics();
            this.background.beginFill('0', 0.5);
            this.background.drawRect(0, 0, gfx.width, gfx.height);
            this.background.endFill();

            var fieldRect = new Rect(5, gfx.height - 160, gfx.width - 24, 130);

            var phase = this.getCurrentPhase();

            this.speakerText = new gfx.pixi.Text('speaker', {
                stroke: 'black',
                strokeThickness: 4,
                align: 'center',
                fill: 'white',
                font: 'bold 16px arial',
            });

            this.speakerText.x = fieldRect.x + 5;
            this.speakerText.y = fieldRect.y + 5;
            this.speakerText.depth = gfx.layers.gui - 10;
            this.dialogText = new gfx.pixi.Text('dialog', {
                stroke: 'black',
                strokeThickness: 3,
                fill: 'white',
                font: 'bold 16px arial',
                wordWrap: true,
                wordWrapWidth: fieldRect.w,
            });

            this.dialogText.x = fieldRect.x + 5;
            this.dialogText.y = this.speakerText.y + this.speakerText.height + 5;
            this.dialogText.depth = this.speakerText.depth;

            var textFieldBack = new ui.TextField('', 5, gfx.height - 160, gfx.width - 10, 155);
            this.add(textFieldBack);

            var skipButton = new ui.Button('skip', {}, function() {
                this.close();
            }, this);
            skipButton.x = gfx.width - skipButton.width;
            this.add(skipButton);

            this.addDisplay(this.background);
            this.addDisplay(this.speakerText);
            this.addDisplay(this.dialogText);

            // Start the first phase.
            this.nextPhase();
        };

        CutsceneState.prototype.update = function(delta) {
            Menu.prototype.update.call(this, delta);

            if (input.mouse.isPressed(input.MOUSE_LEFT)) {
                if (this.phaseIndex+1 >= this.phases.length) {
                    // Exit cutscene after last phase.
                    this.close();
                } else {
                    this.nextPhase();
                }
            }
        };

        CutsceneState.prototype.getCurrentPhase = function() {
            return this.phases[this.phaseIndex];
        };

        // Starts the next phase in the sequence.
        CutsceneState.prototype.nextPhase = function() {
            this.phaseIndex++;
            var phase = this.getCurrentPhase();

            if (!_.isUndefined(phase.background)) {
                this.setBackground(phase.background);
            }

            this.speakerText.setText(phase.speaker);
            this.dialogText.setText(phase.dialog);

            return phase;
        };

        // Sets the background for the cutscene.
        CutsceneState.prototype.setBackground = function(texName) {
            if (this.background) {
                this.removeDisplay(this.background);
            }

            if (_.isNull(texName)) {
                this.background = new gfx.pixi.Graphics();
                this.background.beginFill('0', 0.5);
                this.background.drawRect(0, 0, gfx.width, gfx.height);
                this.background.endFill();
            } else {
                this.background = new gfx.pixi.Sprite(res.tex[texName]);
            }

            this.background.depth = gfx.layers.background;
            this.addDisplay(this.background);
        };

    return {
        global: global,
        setState: setState,
        Field: Field,
        State: State,
        MainMenu: MainMenu,
        TownMenu: TownMenu,
        CutsceneState: CutsceneState,
    };
});
