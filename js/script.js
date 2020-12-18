var width = 650;
var height = 350;
var projection = d3.geo.equirectangular()
    .scale(160*(height/480))
    .center([60,-20]);
var path = d3.geo.path()
    .projection(projection);
var svg = d3.select("#nobel-map")
    .append("svg")
    .attr("width",width)
    .attr("height",height);


// 混雑状況
// twitter
// ツイート数,色
// ポスト,自販機、コンビニ、・・・・
// wifi spot
// 通信可視化, ip addr
// 人口密度


// 現在運行中のスケジュールを返す関数
var getSchedule = function(times){
    // 時刻と何便かの計算
    var date = new Date();
    // テスト用
    //var date = new Date(2020,1,1,8,50);
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

// 2つの緯度経度から距離[km]を返す
function distance(lat1, lng1, lat2, lng2) {
    lat1 *= Math.PI / 180;
    lng1 *= Math.PI / 180;
    lat2 *= Math.PI / 180;
    lng2 *= Math.PI / 180;
    return 6371 * Math.acos(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1) + Math.sin(lat1) * Math.sin(lat2));
}


// アニメーションを生成するために
// 経路をバス停単位に分割して
// バス停間の経路情報を要素として持つ配列polylinesと
// そのバス停間での平均移動速度を単位として持つ配列speedsを返す
var getAnimationInfo = function(schedule,route){
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
        console.log("始発までお待ち下さい");
        return animationInformation;
    }
    // 休憩中
    else if(schedule.length == 2){
        console.log("休憩中");
        return animationInformation;
    }
    // 運行中
    else {
        // 途中経路の緯度経度と時刻を補間してスケジュールを返す
        console.log("運行中");
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
                d += distance(line[i].lng,line[i].lat,line[i+1].lng,line[i+1].lat);
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
        //var now = new Date(2020,1,1,8,50);
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
                var stoptime = busstop.stop.split(":");
                var stop_h = stoptime[0];
                var stop_m = stoptime[1];
                //console.log("現在時刻 {}:{}".format(now_h,now_m));
                //console.log("次のバス停の到着時刻 {}:{}".format(stop_h,stop_m));
                // 現在時刻が過去のものはスキップ
                if(now_h > stop_h || (now_h == stop_h && now_m > stop_m) || (now_h == stop_h && now_m == stop_m)){
                    continue;
                }

                // 現在時刻に基づいて描画開始地点を経路に追加
                if(flag){
                    // 中間点を追加した経路
                    var tmp = []
                    var path = {
                        "バス停名":"経路",
                        "lng":(parseFloat(routeInformation[idx][pathidx-1].lng)+parseFloat(routeInformation[idx][pathidx].lng))/2,
                        "lat":(parseFloat(routeInformation[idx][pathidx-1].lat)+parseFloat(routeInformation[idx][pathidx].lat))/2,
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
                    var dist = distance(busstop.lng,busstop.lat,path.lng,path.lat);
                    if(timeRemaining < 0){
                        runningSpeeds.push(0);
                        console.log(0);
                    }
                    else {
                        runningSpeeds.push((dist*1000)/timeRemaining);
                        console.log((dist*1000)/timeRemaining);
                    }
                    console.log(timeRemaining);
                    
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
// 現在のアニメーションのステップどこまで進んだかを
// 記録するためにanimeStepを管理する
var animeStep = 0;
var incAnimeStep = function(map,speeds,polylines,buscolor){
    animeStep++;
    // 1周終わった
    if(animeStep > speeds.length-1){
        animeStep = 0;
    }
    buildAnimation(map,speeds,polylines,buscolor);
}
// 現在のステップ数(animeStep)に基づいてアニメーションを生成する
// 生成されたアニメーションの実行が終了すると
// 次の経路を生成するための処理が行われ、経路全体を描画するまで実行が続く
var buildAnimation = function(map,speeds,polylines,buscolor="#eb4d4b"){
    var busicon = L.divIcon({
        html: '<i class="fas fa-dot-circle fa-2x" style="color:{}"></i>'.format(buscolor),
        iconSize: [10,10],
        className: 'myDivIcon',
    });
    var latlngs = [];
    for(var point of polylines[animeStep]){
        latlngs.push(L.latLng(parseFloat(point.lng),parseFloat(point.lat)));
    }
    var animatedMarker = L.animatedMarker(latlngs,{
        icon: busicon,
        distance: speeds[animeStep],
        interval: 1000,
        onEnd:function(){
            map.removeLayer(this);
            incAnimeStep(map,speeds,polylines,buscolor);
        }
    }).addTo(map);
}


var drawBus = function(map,scheduleDataURL,routeDataURL,routeDraw=true,routeDrawOptions={color:"green",weight:5,opacity:0.5},buscolor="#eb4d4b"){
    d3.csv(scheduleDataURL,function(error,stops){
        if(error){
            console.warn(error);
        }
        // バス停マーカーを追加
        //! 予定到着時刻を追加する
        var markers = L.markerClusterGroup();
        for(var d of stops){
            var marker = L.marker([d.lng,d.lat]);
            marker.bindPopup("<b>"+d["バス停名"]+"<b>");
            markers.addLayer(marker);
        }
        map.addLayer(markers);
        // バスの運行アニメーション
        d3.csv(routeDataURL,function(error,route){
            // 現在の便の時刻表から平均速度と経路を取得
            var schedule = getSchedule(stops);
            var animeInfo= getAnimationInfo(schedule,route);
            // 運行中の時
            if(animeInfo.runningRoutes.length != 0){
                // アニメーションを描画
                var speeds = animeInfo.runningSpeeds;
                var routes = animeInfo.runningRoutes;
                buildAnimation(map,speeds,routes,buscolor);
            }
            else {
                // 休憩中,終電後のときの処理
                //! 稼働中の色を暗くする
                routeDrawOptions.color = "#40739e";
            }
            if(routeDraw){
                var routeInfo = animeInfo.routeInformation;
                for(var paths of routeInfo){
                    L.polyline(
                        paths.map(function(stop){return [parseFloat(stop.lng),parseFloat(stop.lat)]}),
                        routeDrawOptions
                    ).addTo(map);
                }
            }
        });
    });
}

var main = function(){
    var mapID = 'map';
    var mapZoom = 15;
    var mapViewCenter = [37.910865111417195, 140.1084309247341];
    var map = L.map(mapID).setView(mapViewCenter,mapZoom);
    var accessToken = 'pk.eyJ1Ijoicnlvc3VrZXRha2FoYXNoaSIsImEiOiJja2lqcmU2NHIwMDJzMnZvM29xMXp5aXBlIn0.WCIT7Q-q1jkmsiramG62rA';
    var mapboxTiles = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v10/tiles/{z}/{x}/{y}?access_token='+accessToken, {
           attribution: '© <a href="https://www.mapbox.com/feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // バスの描画
    // 左回り
    var busstopScheduleCounterClockwise = "https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_left_winter.csv";
    var busstopRoute = "https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_left_winter_path.csv";
    drawBus(map,busstopScheduleCounterClockwise,busstopRoute);
    // 右回り
    var busstopScheduleClockwise = "https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_right_winter.csv";
    var busstopRoute = "https://raw.githubusercontent.com/k4zam1/city-viz/master/data/yonezawa_right_winter_path.csv";
    drawBus(map,busstopScheduleClockwise,busstopRoute,routeDraw=true,{color:"orange",weight:5,opacity:0.5},buscolor="#487eb0");

    // クリック時のイベント
    var polygon = [];
    map.on("click",function(e){
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
        polygon.push([lat,lng]);
        if(polygon.length >= 5){
            L.polygon(polygon,
            {
                color: '#f9ca24',
                opacity:0.2,
                fillColor: '#f9ca24',
                fillOpacity: 0.3,
            }).addTo(map);
            // polygonの中身を表示
            for(var poly of polygon){
                console.log("[{},{}]".format(poly[0],poly[1]));
            }
        }
        L.circle([lat,lng],{radius:8}).addTo(map);
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
    L.polygon([
        [37.90192862650271, 140.10269219187714],
        [37.90132020529082, 140.10618593633077],
        [37.89889148866778, 140.105764576877],
        [37.89877618786201, 140.1059123510095],
        [37.89801836994205, 140.10575519725427],
        [37.898203111148, 140.104789472629],
        [37.89832627169436, 140.104789472629],
        [37.898695752097, 140.1031311576159],
        [37.89901134847214, 140.10285802337845]
    ],
    {
        color: '#f9ca24',
        opacity:0.2,
        fillColor: '#f9ca24',
        fillOpacity: 0.3,
    }).addTo(map);
    L.polygon([
        [37.902550676671474, 140.09925914795025],
        [37.90259849691689, 140.09888595283437],
        [37.902062405018775, 140.0987200883384],
        [37.901976831302704, 140.0991283701746],
    ],
    {
        color: '#f9ca24',
        opacity:0.2,
        fillColor: '#f9ca24',
        fillOpacity: 0.3,
    }).addTo(map);
    L.polygon([
        [37.91060003009313,140.10375022888186],
        [37.90858411276492,140.1030904054642],
        [37.90795730368325,140.10586917400363],
        [37.910045234824736,140.10637342929843],
        [37.91030781020605,140.10508596897128],
    ],
    {
        color: '#44bd32',
        opacity:0.2,
        fillColor: '#44bd32',
        fillOpacity: 0.3,
    }).addTo(map);

    
}();