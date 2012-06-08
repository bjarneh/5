//  Copyright © 2012 bjarneh
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.



// utility functions get their own namespace
var util = (function(){

    // random int in interval [0,n]
    function random_int(n){
        return Math.round(Math.random()*n);
    }

    // random int in interval [-n,n]
    function random_neg_int(n){
        var i = random_int(n);
        if( random_bool() ){ i = -1 * i; }
        return i;
    }

    function random_bool(){
        return Math.random() > .5;
    }

    // var_dump like function
    function dump_obj_str(e){

        var x;
        var res = "";

        for(x in e){
            res += x;
            res += " => ";
            res += e[x];
            res += "\n";
        }
    }

    // write var_dump to alert message
    function dump_obj_alert(e){
        alert(dump_obj_str(e));
    }

    return {
        random_int: random_int,
        random_neg_int: random_neg_int,
        random_bool: random_bool,
        dump_obj_str: dump_obj_str,
        dump_obj_alert: dump_obj_alert,
    };

})();


// class Animation and its properties
function Animation(x, y, rate, current, images, xrate, dx){

    this.x       = x;
    this.y       = y;
    this.rate    = rate;
    this.count   = 0;
    this.current = current;
    this.imgs    = images;
    // xrate says how many frames we should wait before we move animation 1px to the right
    this.xrate   = (xrate != null)? xrate : -1; // -1 == never move animation

}

// animate this.imgs[this.current] to graphics2d at this.x this.y
Animation.prototype.animate = function(g2d){

    g2d.drawImage(this.imgs[this.current], this.x, this.y);

    this.count++;

    if(this.count % this.rate == 0){
        this.current = (this.current + 1) % this.imgs.length;
    }
}

// move animation with 1 px always if we are fast, otherwise every other frame
Animation.prototype.move = function(){
    // -1 indicates a non-moving animation
    if( this.xrate == -1){
        return;
    }else if( this.count % this.xrate == 0 ){
        this.x++;
    }
}

// just dump all properties
Animation.prototype.toString = function(){
    return util.dump_obj_str(this);
}

// this is where the logic is
$(document).ready(function(){

    var canvas = $("#canvas")[0];
    var ctx = canvas.getContext("2d");
    var w = $("#canvas").width();
    var h = $("#canvas").height();
    
    // game is always in one of these states
    var GAME            = 1;
    var MENU            = 2;
    var PAUSED          = 3;

    var freq            = 35;   // how often do we refresh canvas in ms
    var score           = 0;    // score one point for each pig killed
    var hiscore         = 0;    // store the score to beat
    var state           = MENU;
    var game_loop       = undefined;

    // variables for drawing background (big and small stars moving left)
    var stars           = [];  // background is an array of stars
    var stars_count     = 150; //
    var stars_draw      = 0;   // big move 1px every frame, small every other
    var stars_big_odds  = 4;   // 1 in 4 (approx.) will be large 2x2 px

    // the 'spacepigs' Image and placement
    var menu_img        = undefined;
    var menu_x          = 187;
    var menu_y          = 250;

    // variables related to explotions
    var explodes        = [];
    var boom_lifetime   = 140;
    var boom_chunks     = 50;
    var boom_max_speed  = 10;
    var boom_max_size   = 3;

    // variables related to the pigs
    var pigs           = [];        // animations of pigs (targets)
    var pig_pool        = 100;       // number of pigs in total
    var big_pig         = undefined; // start-up menu shows one large pig

    // cache the Image objects (pigs in 3 sizes)
    var pigs_gfx  = { 
        small:  {imgs: []},
        large:  {imgs: []},
        medium: {imgs: []}
    };

    function init(){

        init_stars();
        init_pig_gfx();
        init_pigs();
        init_big_pig_and_menu();
        
    }

    function init_big_pig_and_menu(){

        menu_img = new Image();
        menu_img.src = 'gfx/spacepigs.png';
        big_pig = new Animation(100, 100, 2, 1, pigs_gfx.large.imgs);

    }

    function init_pigs(){

        for(var i = 0; i < pig_pool; i++){

            pigs.push( 
                new Animation(
                    0,                      // x : given by pigs_reset  
                    0,                      // y : given by pigs_reset
                    2,                      // how many times do we draw the same pic in animation
                    util.random_int(3),     // which pic in animation starts off
                    pigs_gfx.small.imgs,    // animation will be replaced if pig.is_large
                    util.random_int(1) + 1  // xrate : how many frames to wait before we move animation 1px to the right
                )
            );
        }

        for(var i = 0; i < pig_pool; i++){

            pigs[i].is_large = util.random_bool();

            if(pigs[i].is_large){
                pigs[i].imgs = pigs_gfx.medium.imgs;
            }

            pigs[i].x_offset = (pigs[i].is_large)? 69 : 41;
            pigs[i].y_offset = (pigs[i].is_large)? 72 : 43;

        }

        pigs_reset();
    }

    function init_pig_gfx_single(size, arr){
        var tmp;
        for(var i = 1; i < 5; i++){
            tmp = new Image();
            tmp.src = 'gfx/' + size + 'pig' + i.toString() + '.png';
            arr.imgs.push(tmp);
        }
    }

    function init_pig_gfx(){
        init_pig_gfx_single('30', pigs_gfx.small);
        init_pig_gfx_single('50', pigs_gfx.medium);
        init_pig_gfx_single('100', pigs_gfx.large);
    }

    function init_stars(){
        var tmp;
        for(var i = 0; i < stars_count; i++){
            tmp = util.random_int(stars_big_odds);
            stars.push({ 
                  x:    util.random_int(w),
                  y:    util.random_int(h),
                  size: (tmp == 0)? 2 : 1,
                });
        }
    }

    function pigs_reset(){
        for(var i = 0; i < pig_pool; i++){
            spawn_pig(pigs[i]);
        }
    }

    function spawn_pig(p){
        p.x = util.random_int(w * -1) - 70;
        p.y = util.random_int(h-70) + 10;
    }
    
    function create_bang(x,y){

        var particles = [];

        for(var i = 0; i < boom_chunks; i++){
            particles.push( {
                x:    x,
                y:    y,
                dx:   util.random_neg_int(boom_max_speed),
                dy:   util.random_neg_int(boom_max_speed),
                size: util.random_int(boom_max_size) + 1,
            });

        }

        return { show: 0, chunks: particles };
    }

    function paint(){

        //paint background (entire canvas) black
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "white";
        ctx.strokeRect(0, 0, w, h);

        // paint background stars (in all states)
        paint_stars();

        switch( state ){
            case GAME:
                paint_pigs();
                paint_boom();
                break;
            case MENU:
                paint_menu();
                break;
            case PAUSED:
                paint_pause();
        };

        // paint score
        var score_text = "score: " + score;
        ctx.fillStyle = "yellow";
        ctx.fillText(score_text, 5, h-5);
        if(hiscore > 0){
            var hiscore_text = "hiscore: "+ hiscore;
            ctx.fillText(hiscore_text, 5, 12);
        }
    }

    function paint_pause(){
        ctx.fillStyle = "white";
        tmp           = ctx.font;
        ctx.font      = "50px Arial";
        ctx.fillText("= paused =", 253, 221);
        ctx.font      = tmp;
    }

    function paint_menu(){

        var tmp;
        ctx.fillStyle = "white";
        tmp           = ctx.font;
        ctx.font      = "12px monospace";
        ctx.fillText(" shoot : left mouse button", 290, 323);
        ctx.fillText(" pause : space bar", 290, 341);
        ctx.font      = tmp;

        ctx.drawImage(menu_img, menu_x, menu_y);
        big_pig.animate(ctx);
    }
    
    function paint_pigs(){
        for(var i = 0; i < pig_pool; i++){
            pigs[i].animate(ctx);
            pigs[i].move();
            if(pigs[i].x > w){
                state = MENU;
                if(score > hiscore){ hiscore = score; }
                pigs_reset();
                explodes = [];
            }
        }
    }

    function paint_boom(){
        
        var tmp;
        var bits;
        var done = [];

        ctx.fillStyle = "pink";

        while(explodes.length > 0){
            tmp = explodes.pop();
            bits = tmp.chunks;
            for(var i = 0; i < bits.length; i++){
                ctx.fillRect(bits[i].x, bits[i].y, bits[i].size, bits[i].size);
                bits[i].x += bits[i].dx;
                bits[i].y += bits[i].dy;
            }
            tmp.show++;
            if(tmp.show < boom_lifetime){
                done.push(tmp);
            }
        }

        explodes = done;
    }

    function paint_stars(){

        stars_draw++;

        ctx.fillStyle = "white";

        for(var i = 0; i < stars.length; i++){

            ctx.fillRect(stars[i].x, stars[i].y,stars[i].size,stars[i].size);

            if(stars[i].size == 2){
                stars[i].x--;
            }else if(stars_draw%2 == 0){
                stars[i].x --;
            }

            if(stars[i].x < 0){
                stars[i].x = w;
                stars[i].y = util.random_int(h);
            }

        }
    }

    function a_pig_is_down(x, y){

        for( var i = pig_pool - 1; i >= 0; i-- ){
            if( pig_hit( x, y, pigs[i] ) ){
                spawn_pig(pigs[i]);
                return true;
            }
        }

        return false;
    }

    function pig_hit(x, y, pig){
        if(x >= pig.x && 
           x <= pig.x + pig.x_offset &&
           y >= pig.y &&
           y <= pig.y + pig.y_offset)
        {
            return true;
        }
        return false;
    }
    
    $(document).keydown(function(e){
        //dump_obj_alert(e);
        var key = e.which;
        if(key == "32"){
            if(state == GAME){
                state = PAUSED;
            }else if(state == PAUSED){
                state = GAME;
            }
        }
    });


    $("#canvas").mousedown(function(e){
        
        if( state == PAUSED ){ return; }

        if( state == MENU){
            state = GAME;
            score = 0;
            return;
        }

        if(e.button == 0){ // left button shoots (exlosion if a pig is hit)
            pos = get_mouse_position(e);
            if( a_pig_is_down( pos.x, pos.y ) ){
                explodes.push( create_bang( pos.x, pos.y ) );
                score++;
            }
        }
    });

    // answer from: miki725
    // http://stackoverflow.com/questions/1114465/getting-mouse-location-in-canvas
    function get_mouse_position(e) {

        //http://www.quirksmode.org/js/events_properties.html
        var targ;

        if (!e){ e = window.event; }

        if (e.target){
            targ = e.target;
        }else if (e.srcElement){
            targ = e.srcElement;
        }
        // defeat Safari bug
        if (targ.nodeType == 3){ targ = targ.parentNode; }

        // jQuery normalizes the pageX and pageY
        // pageX,Y are the mouse positions relative to the document
        // offset() returns the position of the element relative to the document
        var x = e.pageX - $(targ).offset().left;
        var y = e.pageY - $(targ).offset().top;

        return {"x": x, "y": y};
    };
    
    
    // main
    {
        init();

        //every freq ms
        if(typeof game_loop != "undefined"){
            clearInterval(game_loop);
        }

        game_loop = setInterval(paint, freq);
    }
});
