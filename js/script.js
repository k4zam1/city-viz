// xx:xx 形式の文字列どうしを比較する

var strTimeSplit = function(str_t){
    // xx:xx形式の時間をhour,minに分割
    var splitted = str_t.split(":");
    var hour = parseInt(splitted[0]);
    var min = parseInt(splitted[1]);
    return {h:hour,m:min};
}

var isPast = function(t1str,t2str){
    var t1 = strTimeSplit(t1str);
    var t2 = strTimeSplit(t2str);
    var isPast = true;
    if(t1.h > t2.h || (t1.h == t2.h && t1.m > t2.m)){
        isPast = false;
    }
    return isPast;

}
var isFuture = function(t1str,t2str){
    var isFuture = true;
    if(isPast(t1str,t2str)){
        isFuture = false;
    }
    return isFuture;
}

var inTime = function(now_t,start_t,end_t){
    var intime = true;
    // now_tがtart_tより過去　->　時間外
    if(isPast(now_t,start_t)){
        intime = false;
    }
    // now_tがend_tより未来 -> 時間外
    else if(isFuture(now_t,end_t)){
        intime = false;
    }
    return intime;
}


class Bus {
    constructor(options){
        this.map = options.map;
        this.scheduleDataURL = options.scheduleDataURL;
        this.routeDataURL = options.routeDataURL;
        this.busColor = options.busColor;
        this.busIcon = L.divIcon({
            html: '<i class="fas fa-bus fa-2x" style="color:{}"></i>'.format(this.busColor),
            iconSize: [10,10],
            className: 'myDivIcon',
        });
        this.routeColor = options.routeColor;
        this.routeColorSleep = options.routeColorSleep;
        this.routeDraw = options.routeDraw;
        this.markerDraw = options.markerDraw;
        this.busMarker = null;
        this.sleepWait = false;
    }
    // 現在運行中のスケジュールを返す関数
    _getSchedule(times){
        // 時刻と何便かの計算
        var date = new Date();
        // テスト用
        //var date = new Date(2020,1,1,8,50,50);
        var now_h = date.getHours();
        var now_m = date.getMinutes();
        var schedule = [];
        for(var i=1;i<11;i++){
            // 現在時刻が終点時刻を超える最大の便を見つける
            var time = times[0][i].split(":");
            var service = new Date(2020,1,1,parseInt(time[0]),parseInt(time[1]));
            var service_h = service.getHours();
            if(service_h > now_h){
                // 現在時刻を含む可能性があるのはi-1便
                var idx = i-1;
                // 運行中か判定する
                // idx < 0なら確実に停止中
                if(idx > 0){
                    var start = times[0][idx];
                    var end = times[times.length-1][idx];
                    var now_t = "{}:{}".format(now_h,now_m);
                    var inService = false;
                    if(inTime(now_t,start,end)){
                        inService = true;
                    }
                    /*
                    var idx_Endtime = times[times.length-1][idx].split(":");
                    var idx_endservice = new Date(2020,1,1,parseInt(idx_Endtime[0]),parseInt(idx_Endtime[1]));
                    var end_h = idx_endservice.getHours();
                    var end_m = idx_endservice.getMinutes();
                    var idx_Starttime = times[0][idx].split(":");
                    var idx_startservice = new Date(2020,1,1,parseInt(idx_Starttime[0]),parseInt(idx_Starttime[1]));
                    var start_h = idx_startservice.getHours();
                    var start_m = idx_startservice.getMinutes();
                    var inService = false;
                    // 始発時間を超えている                      &&        終点時刻の中に収まっている
                    if(((now_h >= start_h && now_m >= start_m) && (end_h == now_h && end_m > now_m))){
                        inService = true;
                    }
                    else if(((now_h > start_h) && end_h >= now_h) || (end_h > now_h)){
                        inService = true;
                    }
                    */
                }
                // idx便が運行中
                // idx便のスケジュールを格納する
                if(inService){
                    // idx便の時刻表を取得する
                    for(var j=0;j<times.length;j++){
                        var stopSchedule = {"station":times[j]["バス停名"],"stop":times[j][idx]};
                        schedule.push(stopSchedule);
                    }
                    break;
                }
                // 休憩中,停止中
                // 各スケジュールを格納する
                else {
                    var l = times.length-1;
                    // 現在時刻：始発前,終点後
                    if(idx-1 < 1 || idx > 10){
                        break;
                    }
                    schedule.push({"station":times[l]["バス停名"],"stop":times[l][idx-1]});
                    schedule.push({"station":times[0]["バス停名"],"stop":times[0][idx]});
                    break;
                }
            }
        }
        return schedule;
    }

    // アニメーションを生成するために
    // 経路をバス停単位に分割して
    // バス停間の経路情報を要素として持つ配列polylinesと
    // そのバス停間での平均移動速度を単位として持つ配列speedsを返す
    _getAnimationInfo = function(schedule,route){
        var animationInformation = {
            runningSpeeds:[],
            runningRoutes:[],
            routeInformation:[]
        };
        // 経路描画用の線を取得
        // バスの経路を描画してしまうと
        // バス停間の仮想的な点も含まれてしまうため
        var routeInformation = []
        var count = 0;
        var tmp = [];
        for(var stop of route){
            tmp.push(stop)
            if(stop.isStation == "1"){
                count++;
                if(count == 2){
                    routeInformation.push(tmp);
                    tmp = [stop];
                    count = 1;
                }
            }
        }
        animationInformation.routeInformation = routeInformation;
        //console.log(routeInformation);

        // 停止中
        if(schedule.length < 1){
            //console.log("始発までお待ち下さい");
            animationInformation.state = 0;
            return animationInformation;
        }
        // 休憩中
        else if(schedule.length == 2){
            //console.log("休憩中");
            animationInformation.state = 1;
            return animationInformation;
        }
        // 運行中
        else {
            animationInformation.state = 2;
            // 途中経路の緯度経度と時刻を補間してスケジュールを返す
            //console.log("運行中");
            // バス停の到着時間を追加
            var count = -1;
            for(var r of route){
                if(r.isStation == "1"){
                    count++;
                    r.stop = schedule[count].stop;
                }
            }
            // 平均移動速度を計算する
            var speeds = [];
            for(var line of routeInformation){
                // バス停間の距離[km]を計算
                var d = 0;
                var t_1 = 0;
                var t_2 = 0;
                var startFlag = false;
                for(var i=0;i<line.length-1;i++){
                    d += this._distance(line[i].lng,line[i].lat,line[i+1].lng,line[i+1].lat);
                    if(line[i].isStation == "1" && !startFlag){
                        t_1 = line[i].stop;
                        startFlag = true;
                    }
                    if(line[i+1].isStation == "1"){
                        t_2 = line[i+1].stop;
                    }
                }
                // km -> m
                d *= 1000;
                // 走行時間を計算[s]
                t_1 = t_1.split(":");
                t_1 = new Date(2020,1,1,t_1[0],t_1[1]);
                t_2 = t_2.split(":");
                t_2 = new Date(2020,1,1,t_2[0],t_2[1]);
                var time = (t_2-t_1)/1000;
                // 移動速度[m/s]を計算
                var speed = d/time;
                speeds.push(speed);
                //console.log(speed*3.6+"km/h");
            }
            // 現在時刻に基づいて不要な経路を削除する
            // -> 必要な経路をrunningRoutesに抽出する
            var now = new Date();
            // テスト用
            //var now = new Date(2020,1,1,8,50,50);
            var now_h = now.getHours();
            var now_m = now.getMinutes();
            var now_s = now.getSeconds();
            var idx = 0;
            var runningRoutes = [];
            var runningSpeeds = []
            var flag = true;
            for(var line of routeInformation){
                var pathidx = -1;
                for(var busstop of line){
                    pathidx++;
                    if(busstop.isStation == "0"){
                        continue;
                    }
                    // はじめて現在時刻より未来のバス停を見つけたとき
                    // ひとつ前のバス停と,そのバス停の間の経路を走っている

                    // 現在時刻が過去のものはスキップ
                    /*
                    var stoptime = busstop.stop.split(":");
                    var stop_h = stoptime[0];
                    var stop_m = stoptime[1];
                    if(now_h > stop_h || (now_h == stop_h && now_m > stop_m) || (now_h == stop_h && now_m == stop_m)){
                        continue;
                    }
                    */
                    if(isPast(busstop.stop,"{}:{}".format(now_h,now_m))){
                        continue;
                    }
                    

                    // 現在時刻に基づいて描画開始地点を経路に追加
                    if(flag){
                        var stoptime = busstop.stop.split(":");
                        var stop_h = stoptime[0];
                        var stop_m = stoptime[1];
                        //console.log("現在時刻 {}:{}".format(now_h,now_m));
                        //console.log("次のバス停の到着時刻 {}:{}".format(stop_h,stop_m));
                        // 中間点を追加した経路
                        var tmp = []
                        var path = {
                            "バス停名":"経路",
                            "lng":(
                                parseFloat(routeInformation[idx][pathidx-1].lng) + 
                                parseFloat(routeInformation[idx][pathidx].lng))/2,
                            "lat":(
                                parseFloat(routeInformation[idx][pathidx-1].lat) + 
                                parseFloat(routeInformation[idx][pathidx].lat))/2,
                            "isStation":"0",
                            "stop":"{}:{}".format(now_h,zeroPadding(now_m,2))
                        };
                        tmp.push(path);
                        for(var p of routeInformation[idx].slice(pathidx)){
                            tmp.push(p);
                        }
                        runningRoutes.push(tmp);
                        // 現在時刻から到着時刻までのスピード[m/s]を再計算する
                        // timeRemaining[s]で次のバス停に到着する
                        //console.log(now_h,now_m,now_s);
                        //console.log(stop_h,stop_m);
                        var dnow = new Date(2020,1,1,now_h,now_m,now_s);
                        var dstp = new Date(2020,1,1,stop_h,stop_m,0);
                        var timeRemaining = (dstp-dnow)/1000;
                        var dist = this._distance(busstop.lng,busstop.lat,path.lng,path.lat);
                        if(timeRemaining < 0){
                            runningSpeeds.push(0);
                            //console.log(0);
                        }
                        else {
                            runningSpeeds.push((dist*1000)/timeRemaining);
                            //console.log((dist*1000)/timeRemaining);
                        }
                        //console.log(timeRemaining);
                        
                        flag = false;
                    }
                    else {
                        // バス停間にはisStation == 1のデータが2つあるので
                        // breakしなければ2回実行される
                        // 一度情報をpushできればいい
                        runningRoutes.push(routeInformation[idx]);
                        runningSpeeds.push(speeds[idx]);
                        break;
                    }
                }
                idx++;
            }
            //console.log(runningRoutes);
            //console.log(runningSpeeds);
            animationInformation.runningRoutes = runningRoutes;
            animationInformation.runningSpeeds = runningSpeeds;
            return animationInformation;
        }
    }

    // アニメーション関連
    // アニメーションは各経路間の等速直線運動で表現する
    // 現在のステップ数(step)に基づいてアニメーションを生成する
    // 生成されたアニメーションの実行が終了すると
    // 次の経路を生成するための処理が行われ、経路全体を描画するまで実行が続く
    _buildAnimation(speeds,polylines,step=0){
        var latlngs = [];
        for(var point of polylines[step]){
            latlngs.push(L.latLng(parseFloat(point.lng),parseFloat(point.lat)));
        }
        var that = this;
        this.busMarker = L.animatedMarker(latlngs,{
            icon: this.busIcon,
            distance: speeds[step],
            interval: 1000,
            onEnd:function(){
                that.map.removeLayer(this);
                step++;
                if(step < speeds.length){
                    that._buildAnimation(speeds,polylines,step);
                }
                else {
                    that.draw();
                }
            },
            popup:function(){
                var path = polylines[step];
                var station = polylines[step][path.length-1]["バス停名"];
                var stop = polylines[step][path.length-1].stop;
                return "<b>{}</b>行き<br/>到着予定 <b>{}</b>".format(station,stop);
            }

        }).addTo(this.map);
        this.map.on("zoomend",function(){
            that.onend = false;
            that.busMarker.stop();
            that.map.removeLayer(that.busMarker);
            that.busMarker = null;
            that.draw();
            that.map.on("zoomend",function(){});
        });
    }
    // 2つの緯度経度から距離[km]を返す
    _distance(lat1, lng1, lat2, lng2) {
        lat1 *= Math.PI / 180;
        lng1 *= Math.PI / 180;
        lat2 *= Math.PI / 180;
        lng2 *= Math.PI / 180;
        return 6371 * Math.acos(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1) + Math.sin(lat1) * Math.sin(lat2));
    }

    draw(){
        var that = this;
        d3.csv(this.scheduleDataURL,function(error,stops){
            if(error){
                console.warn(error);
            }
            // バス停マーカーを追加
            if(that.markerDraw){
                var markers = L.markerClusterGroup();
                var markerIcon = L.divIcon({
                    html: '<i class="fas fa-pause-circle" style="color:#eccc68;font-size:15px;"></i>',
                    iconSize: [10,10],
                    className: 'myDivIcon',
                });
                for(var d of stops){
                    var marker = L.marker([d.lng,d.lat],{icon:markerIcon});
                    marker.bindPopup("<b>"+d["バス停名"]+"<b>");
                    markers.addLayer(marker);
                }
                that.map.addLayer(markers);
                that.markerDraw = false;
            }
            // バスの運行アニメーション
            d3.csv(that.routeDataURL,function(error,route){
                // 現在の便の時刻表から平均速度と経路を取得
                var schedule = that._getSchedule(stops);
                var animeInfo= that._getAnimationInfo(schedule,route);
                var speeds = animeInfo.runningSpeeds;
                var routes = animeInfo.runningRoutes;
                var routeInfo = animeInfo.routeInformation;
                // 運行中の時
                if(animeInfo.runningRoutes.length != 0){
                    // アニメーションを描画
                    that._buildAnimation(speeds,routes);
                }
                else {
                    // 休憩中 or 終電後
                    // 運行開始まで待つ
                    var iid = setInterval(function(){
                        var schedule = that._getSchedule(stops);
                        if(schedule.length > 2){
                            clearInterval(iid);
                        }
                    },1000*10);
                }
                // 経路の描画
                if(that.routeDraw){
                    var color = that.routeColor;
                    // 現在運行中じゃなければ色を変える
                    if(animeInfo.state != 2){
                        color = that.routeColorSleep;
                    }
                    for(var paths of routeInfo){
                        L.polyline(
                            paths.map(function(stop){return [parseFloat(stop.lng),parseFloat(stop.lat)]}),
                            {color:color,weight:6,opacity:0.7}
                        ).addTo(that.map);
                    }
                    that.routeDraw = false;
                }
            });
        });
    }
}



var main = function(){
    var mapOps = {
        id:"map",
        zoomDefault:15,
        viewDefault:[37.910865111417195, 140.1084309247341],
        tileURL:'https://api.mapbox.com/styles/v1/k4zam1/ckiulgjmf240b19ph37u9wppu/tiles/256/{z}/{x}/{y}?access_token='+
        "pk.eyJ1IjoiazR6YW0xIiwiYSI6ImNraXVqdnN2ZDBjcm8yeG51bXVwcmdkdGIifQ.8a5LkX3MhXE-soiWUBw6yQ",
        tileAttribution:`© <a href="https://apps.mapbox.com/feedback/">Mapbox</a> 
        © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>`
    };
    var map = L.map(mapOps.id).setView(mapOps.viewDefault,mapOps.zoomDefault);
    var mapStyle = L.tileLayer(mapOps.tileURL, {
        attribution:mapOps.tileAttribution,
        maxZoom:21
    }).addTo(map);

    // バスの描画
    var busLeft = new Bus({
        map:map,
        scheduleDataURL:"https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_left_winter.csv",
        routeDataURL:"https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_left_winter_path.csv",
        busColor:"#fc5c65",
        routeColor:"#20bf6b",
        routeColorSleep:"#40739e",
        routeDraw:true,
        markerDraw:true,
    });
    busLeft.draw();
    var busRight = new Bus({
        map:map,
        scheduleDataURL:"https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_right_winter.csv",
        routeDataURL:"https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_right_winter_path.csv",
        busColor:"#fd9644",
        routeColor:"#20bf6b",
        routeColorSleep:"#40739e",
        routeDraw:true,
        markerDraw:false,
    });
    busRight.draw();

    //! モード選択機能
    //! 経路検索,情報追加,その他カスタマイズ機能
    // クリック時のイベント
    var polygon = [];
    map.on("click",function(e){
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
        polygon.push([lat,lng]);
        // polygonの中身を表示
        console.log("選択中({})：".format(polygon.length));
        for(var poly of polygon){
            console.log("[{},{}],".format(poly[0],poly[1]));
        }
        L.circle([lat,lng],{radius:0.5}).addTo(map);
    });
      
    // 現在地の追加
    navigator.geolocation.getCurrentPosition(function(position){
        var icon = L.divIcon({
            html: '<i class="fas fa-user-circle fa-2x" style="color:#f0932b"></i>',
            iconSize: [10,10],
            className: 'myDivIcon',
        });
        var marker = L.marker([position.coords.latitude,position.coords.longitude],{icon:icon,opacity:0.7})
            .bindPopup("<b>You<b>")
            .addTo(map);
        L.Routing.control({
            waypoints: [
                L.latLng(position.coords.latitude,position.coords.longitude),
                L.latLng(37.909623944684554, 140.12740256754844)
            ],
            lineOptions: {
                styles: [{color: '#f0932b', opacity: 0.7, weight: 5}]
            },
            routeWhileDragging: true,
        }).addTo(map);
    });

    // エリアの描画
    var areaDataURL = "https://raw.githubusercontent.com/k4zam1/city-viz/main/data/area.json";
    d3.json(areaDataURL,function(error,areas){
        if(error){
            console.warn(error);
        }
        for(var area of areas){
            // 営業時間内ならdefaultColor
            var color = area.defaultColor;
            var now = new Date();
            var open = area.open[0];
            var close = area.open[1];
            var now_t = "{}:{}".format(now.getHours(),now.getMinutes());
            // 営業時間外
            if(area.workday[now.getDay()] == 0 || !inTime(now_t,open,close)){
                color = area.sleepColor;
            }
            // 描画
            L.polygon(area.area,{
                color:color,
                opacity:0.2,
                fillColor:color,
                fillOpacity:0.3
            }).addTo(map);
        }
    })

    // 時計を表示
    var options = {
        title:'<i class="far fa-clock"></i> {}:{}:{}'.format("00","00","00"),
        content:"",
        modal: false,
        position:'bottomLeft', // 'center', 'top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left', 'topLeft'
        closeButton:false,
    };
    var watch =  L.control.window(map, options).show();
    setInterval(function(){
        var now = new Date();
        var now_h = now.getHours();
        var now_m = now.getMinutes();
        var now_s = now.getSeconds();
        watch.title('　<i class="far fa-clock"></i> {}:{}:{}'.format(
            zeroPadding(now_h,2),zeroPadding(now_m,2),zeroPadding(now_s,2)));
    },1000);

}();