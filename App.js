// CYQONX Terminal — React Native / Expo
// ทำงานเหมือนกับ web app ทุกอย่าง รวม Binance WS + REST API

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ActivityIndicator
} from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Path, Rect, Line, Circle, Polyline, Text as SvgText, Defs, LinearGradient, Stop, ClipPath, G, Ellipse } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

const W = Dimensions.get('window').width;

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:    '#F2F0EE', bg2:  '#E6E2DF', card: '#F5F4F1',
  dark:  '#2F2926', d2:   '#7C7773', d3:   '#A7A29E',
  bord:  'rgba(45,41,38,0.10)',
  grn:   '#4A6355', grnL: '#7A9680',
  red:   '#7A4A48', redL: '#A07070',
  gld:   '#7A6438', gldL: '#A08858',
  blu:   '#3A5272',
  prp:   '#5A4878',
};

// ── Shadows (RN style) ────────────────────────────────────────────────────────
const shadow = {
  shadowColor: '#2F2926', shadowOffset: {width:4,height:4},
  shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
};
const shadowSm = {
  shadowColor: '#2F2926', shadowOffset: {width:2,height:2},
  shadowOpacity: 0.14, shadowRadius: 5, elevation: 3,
};
const shadowDk = {
  shadowColor: '#0a0808', shadowOffset: {width:4,height:4},
  shadowOpacity: 0.40, shadowRadius: 10, elevation: 10,
};

// ── Math / OU Engine ──────────────────────────────────────────────────────────
const SYMBOLS = {
  BTC: {
    id:'BTC', label:'BITCOIN / USD', sub:'BTC/USD', icon:'₿',
    binanceSymbol:'BTCUSDT', wsStream:'btcusdt@trade',
    middle:74113.04, upper:81078.5, lower:67804.49,
    sigma:1300, theta:0.15, color:C.grn,
  },
  XAU: {
    id:'XAU', label:'GOLD / USD', sub:'XAU/USD', icon:'Au',
    binanceSymbol:'XAUUSDT', wsStream:'xauusdt@trade',
    middle:2350, upper:2480, lower:2220,
    sigma:18, theta:0.12, color:C.gld,
  },
};

function ouSim(P0,M,th,sig,n){
  const a=[P0];let P=P0;
  for(let i=0;i<n;i++){P+=th*(M-P)+(Math.random()*2-1)*sig*1.2;a.push(P);}
  return a;
}
function hurstCalc(path){
  if(path.length<8)return 0.5;
  const n=path.length,m=path.reduce((a,b)=>a+b,0)/n,d=path.map(x=>x-m);
  let c=0,hi=-1e9,lo=1e9;
  d.forEach(x=>{c+=x;if(c>hi)hi=c;if(c<lo)lo=c;});
  const R=hi-lo,S=Math.sqrt(d.reduce((a,b)=>a+b*b,0)/n);
  return S===0?0.5:Math.log(R/S)/Math.log(n);
}
function calibrateOU(prices){
  const n=prices.length;
  if(n<10)return{theta:0.15,mu:prices[n-1]||0,sigma:500,halfLife:4.6};
  const X=prices.slice(0,n-1),Y=prices.slice(1);
  const mX=X.reduce((a,b)=>a+b,0)/X.length,mY=Y.reduce((a,b)=>a+b,0)/Y.length;
  let cov=0,varX=0;
  for(let i=0;i<X.length;i++){cov+=(X[i]-mX)*(Y[i]-mY);varX+=(X[i]-mX)**2;}
  varX=varX||1e-10;
  let b=Math.max(0.01,Math.min(0.9999,cov/varX));
  const a2=mY-b*mX,mu=a2/(1-b);
  const theta=Math.max(0.001,Math.min(2,-Math.log(b)));
  const resid=X.map((_,i)=>Y[i]-(a2+b*X[i]));
  const varR=resid.reduce((s,r)=>s+r*r,0)/resid.length;
  const sigma=Math.max(1,Math.sqrt(varR)*Math.sqrt(2*theta/(1-b*b)));
  return{theta,mu,sigma,halfLife:Math.log(2)/theta};
}
function calcLQChannel(prices,ou){
  const recent=prices.slice(-50);
  const swH=Math.max(...recent),swL=Math.min(...recent);
  return{
    upper:ou.mu*0.6+swH*0.4+ou.sigma*0.8,
    middle:ou.mu,
    lower:ou.mu*0.6+swL*0.4-ou.sigma*0.8,
  };
}
function calcImpliedVol(prices){
  if(prices.length<2)return 0;
  const ret=[];
  for(let i=1;i<prices.length;i++){if(prices[i-1]>0)ret.push(Math.log(prices[i]/prices[i-1]));}
  if(!ret.length)return 0;
  const m=ret.reduce((a,b)=>a+b,0)/ret.length;
  const v=ret.reduce((s,r)=>s+(r-m)**2,0)/ret.length;
  return Math.sqrt(v)*Math.sqrt(252)*100;
}

// ── UI Components ─────────────────────────────────────────────────────────────
function Card({children,style}){
  return(
    <View style={[{background:C.card,backgroundColor:C.card,borderRadius:20,padding:16,marginBottom:12,borderWidth:1,borderColor:C.bord},shadow,style]}>
      {children}
    </View>
  );
}
function Inset({children,style}){
  return(
    <View style={[{backgroundColor:C.bg2,borderRadius:14,borderWidth:1,borderColor:C.bord,shadowColor:'#fff',shadowOffset:{width:-2,height:-2},shadowOpacity:0.8,shadowRadius:4},style]}>
      {children}
    </View>
  );
}
function Btn({children,dark,onPress,style}){
  return(
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[{backgroundColor:dark?C.dark:C.card,borderRadius:13,borderWidth:1,borderColor:dark?C.dark:C.bord,alignItems:'center',justifyContent:'center'},dark?shadowDk:shadowSm,style]}>
      {children}
    </TouchableOpacity>
  );
}

// Sparkline SVG
function Spark({data,color,height=60}){
  if(!data||data.length<2)return<View style={{height}}/>;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const cw=W-56,H=height;
  const px=i=>(i/(data.length-1))*cw;
  const py=v=>H-((v-mn)/rng)*H*0.85-H*0.075;
  const pts=data.map((v,i)=>px(i)+','+py(v)).join(' ');
  const area='M'+px(0)+','+H+' '+data.map((v,i)=>'L'+px(i)+','+py(v)).join(' ')+' L'+px(data.length-1)+','+H+' Z';
  return(
    <Svg width={cw} height={H}>
      <Defs>
        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <Stop offset="100%" stopColor={color} stopOpacity="0"/>
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sg)"/>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </Svg>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomePage({price,hist,H,z,setPage,sym,wsStatus,calibStatus}){
  const [tf,setTf]=useState('1D');
  const change=hist.length>1?price-hist[0]:0;
  const pct=hist.length>1?(change/hist[0])*100:0;
  const isUp=change>=0;
  const regime=H>0.6?'TRENDING':H<0.4?'MEAN REV':'NEUTRAL';
  const rColor=H>0.6?C.red:H<0.4?C.grn:C.gld;
  const fmt=v=>sym.id==='XAU'?'$'+v.toFixed(2):'$'+Math.round(v).toLocaleString();
  const tfs=['1H','4H','1D','1W','1M'];

  return(
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Welcome */}
      <View style={{paddingBottom:14}}>
        <Text style={{fontSize:9,letterSpacing:2,color:C.d3,textTransform:'uppercase',marginBottom:4}}>Welcome back</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={[{width:34,height:34,borderRadius:11,backgroundColor:C.card,alignItems:'center',justifyContent:'center'},shadowSm]}>
            <Text style={{fontSize:14}}>🪐</Text>
          </View>
          <View>
            <Text style={{fontSize:9,color:C.d3,letterSpacing:1}}>CYQONX</Text>
            <Text style={{fontSize:16,fontWeight:'700',color:C.dark}}>Choux Trader</Text>
          </View>
          <Btn style={{marginLeft:'auto',paddingHorizontal:14,paddingVertical:7}}>
            <Text style={{fontSize:10,fontWeight:'700',color:C.d2,letterSpacing:1}}>Portfolio</Text>
          </Btn>
        </View>
      </View>

      {/* Price dark card */}
      <View style={[{backgroundColor:C.dark,borderRadius:24,padding:18,marginBottom:12,overflow:'hidden'},shadowDk]}>
        <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <View style={{width:38,height:38,borderRadius:19,backgroundColor:'rgba(245,244,241,0.10)',alignItems:'center',justifyContent:'center'}}>
              <Text style={{fontSize:sym.id==='XAU'?11:16,fontWeight:'700',color:'#F5F4F1'}}>{sym.icon}</Text>
            </View>
            <View>
              <Text style={{fontSize:13,fontWeight:'600',color:'#F5F4F1'}}>{sym.label}</Text>
              <Text style={{fontSize:10,color:'rgba(245,244,241,0.45)'}}>Real-time Price</Text>
            </View>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(245,244,241,0.09)',borderRadius:20,paddingHorizontal:10,paddingVertical:5}}>
            <View style={{width:5,height:5,borderRadius:3,backgroundColor:wsStatus==='LIVE'?C.grnL:C.gld}}/>
            <Text style={{fontSize:9,fontWeight:'600',color:'rgba(245,244,241,0.82)'}}>{wsStatus}</Text>
          </View>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          <View>
            <Text style={{fontSize:8,color:'rgba(245,244,241,0.38)',letterSpacing:2,marginBottom:3}}>LAST PRICE</Text>
            <Text style={{fontSize:34,fontWeight:'300',color:'#F5F4F1',letterSpacing:-1}}>{fmt(price)}</Text>
            <Text style={{fontSize:12,color:isUp?C.grnL:C.redL,marginTop:3}}>{isUp?'+':''}{change.toFixed(2)} ({isUp?'+':''}{pct.toFixed(2)}%)</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
            <Text style={{fontSize:8,color:'rgba(245,244,241,0.38)',letterSpacing:2,marginBottom:3}}>REGIME</Text>
            <Text style={{fontSize:13,fontWeight:'700',color:rColor}}>{regime}</Text>
            <Text style={{fontSize:9,color:'rgba(245,244,241,0.38)',fontVariant:['tabular-nums'],marginTop:3}}>H = {H.toFixed(3)}</Text>
          </View>
        </View>
        <Spark data={hist.slice(-60)} color={isUp?C.grnL:C.redL} height={50}/>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}>
          {tfs.map(t=>(
            <TouchableOpacity key={t} onPress={()=>setTf(t)}
              style={{paddingHorizontal:8,paddingVertical:4,borderRadius:7,backgroundColor:t===tf?'rgba(245,244,241,0.10)':'transparent'}}>
              <Text style={{fontSize:10,fontWeight:t===tf?'700':'400',color:t===tf?'rgba(245,244,241,1)':'rgba(245,244,241,0.35)'}}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
        {[
          {id:'chart',lbl:'CHART',icon:'📊'},
          {id:'waves',lbl:'WAVE',icon:'〰'},
          {id:'ai',lbl:'AI',icon:'◈'},
          {id:'analytics',lbl:'ANA',icon:'▦'},
          {id:'watchlist',lbl:'WATCH',icon:'◉'},
        ].map(a=>(
          <TouchableOpacity key={a.id} onPress={()=>setPage(a.id)}
            style={[{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:12,backgroundColor:C.card,borderRadius:16,borderWidth:1,borderColor:C.bord},shadowSm]}>
            <Text style={{fontSize:18,marginBottom:4}}>{a.icon}</Text>
            <Text style={{fontSize:8,fontWeight:'700',color:C.d2,letterSpacing:1}}>{a.lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Channel levels */}
      <Card>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <Text style={{fontSize:9,fontWeight:'700',color:C.d3,letterSpacing:2,textTransform:'uppercase'}}>LQ Channel</Text>
          <Text style={{fontSize:9,fontWeight:'700',color:C.blu,letterSpacing:1}}>{calibStatus}</Text>
        </View>
        {[{l:'LQ UPPER',v:sym.upper,c:C.red},{l:'EQUILIBRIUM μ',v:sym.middle,c:C.gld},{l:'SUPPORT',v:sym.lower,c:C.blu}].map((row,i,arr)=>(
          <View key={row.l} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:i<arr.length-1?1:0,borderBottomColor:C.bord}}>
            <Text style={{fontSize:11,color:C.d2}}>{row.l}</Text>
            <Text style={{fontSize:13,fontWeight:'700',color:row.c,fontVariant:['tabular-nums']}}>{fmt(row.v)}</Text>
          </View>
        ))}
      </Card>

      {/* AI Signal */}
      <Card>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <Text style={{fontSize:11,fontWeight:'700',color:C.dark,letterSpacing:1,textTransform:'uppercase'}}>AI Signal</Text>
          <Inset><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:4}}>
            <View style={{width:5,height:5,borderRadius:3,backgroundColor:C.grnL}}/>
            <Text style={{fontSize:9,fontWeight:'700',color:C.grn}}>LIVE</Text>
          </View></Inset>
        </View>
        {[
          {l:'Regime',v:regime,c:rColor},
          {l:'Z-Score',v:(z>=0?'+':'')+z.toFixed(2)+' σ',c:Math.abs(z)>2?C.red:Math.abs(z)>1?C.gld:C.grn},
          {l:'Hurst H',v:'H = '+H.toFixed(3),c:C.dark},
        ].map((row,i,arr)=>(
          <View key={row.l} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:i<arr.length-1?1:0,borderBottomColor:C.bord}}>
            <Text style={{fontSize:11,color:C.d2}}>{row.l}</Text>
            <Text style={{fontSize:12,fontWeight:'700',color:row.c,fontVariant:['tabular-nums']}}>{row.v}</Text>
          </View>
        ))}
      </Card>
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ── CHART PAGE ────────────────────────────────────────────────────────────────
function ChartPage({sym,price}){
  const [candles,setCandles]=useState([]);
  const [tf,setTf]=useState('15m');
  const [loading,setLoading]=useState(true);
  const wsRef=useRef(null);
  const TFS=['1m','5m','15m','1h','4h','1d'];

  useEffect(()=>{
    setLoading(true);
    fetch('https://api.binance.com/api/v3/klines?symbol='+sym.binanceSymbol+'&interval='+tf+'&limit=80')
      .then(r=>r.json())
      .then(data=>{
        setCandles(data.map(c=>({t:parseInt(c[0]),o:parseFloat(c[1]),h:parseFloat(c[2]),l:parseFloat(c[3]),c:parseFloat(c[4]),v:parseFloat(c[5])})));
        setLoading(false);
      }).catch(()=>setLoading(false));
  },[tf,sym.binanceSymbol]);

  useEffect(()=>{
    if(wsRef.current)wsRef.current.close();
    try{
      const ws=new WebSocket('wss://stream.binance.com:9443/ws/'+sym.binanceSymbol.toLowerCase()+'@kline_'+tf);
      wsRef.current=ws;
      ws.onmessage=e=>{
        try{
          const k=JSON.parse(e.data).k;
          if(!k)return;
          const nc={t:k.t,o:parseFloat(k.o),h:parseFloat(k.h),l:parseFloat(k.l),c:parseFloat(k.c),v:parseFloat(k.v),live:true};
          setCandles(prev=>{
            if(!prev.length)return prev;
            const last=prev[prev.length-1];
            if(last.t===nc.t)return [...prev.slice(0,-1),nc];
            if(nc.t>last.t)return [...prev.slice(1),nc];
            return prev;
          });
        }catch(e){}
      };
    }catch(e){}
    return()=>{if(wsRef.current)wsRef.current.close();};
  },[tf,sym.binanceSymbol]);

  const cw=W-32;const H=220;const PL=40,PR=28,PT=12,PB=18;
  const vis=candles.slice(-50);
  const hi=vis.length?Math.max(...vis.map(c=>c.h)):price*1.01;
  const lo=vis.length?Math.min(...vis.map(c=>c.l)):price*0.99;
  const rng=hi-lo||1;
  const chartW=cw-PL-PR,chartH=H-PT-PB;
  const toX=i=>PL+(i+0.5)*(chartW/Math.max(vis.length,1));
  const toY=v=>PT+chartH-(v-lo)/rng*chartH;
  const bw=Math.max(2,chartW/Math.max(vis.length,1)*0.6);
  const fmt=v=>sym.id==='XAU'?'$'+v.toFixed(1):'$'+Math.round(v).toLocaleString();

  return(
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <View>
          <Text style={{fontSize:17,fontWeight:'700',color:C.dark}}>{sym.label}</Text>
          <Text style={{fontSize:9,color:C.d3,letterSpacing:1,textTransform:'uppercase',marginTop:1}}>Candlestick · LQ Channel</Text>
        </View>
        <Inset><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:4}}>
          <View style={{width:5,height:5,borderRadius:3,backgroundColor:C.grnL}}/>
          <Text style={{fontSize:9,fontWeight:'700',color:C.grn}}>LIVE</Text>
        </View></Inset>
      </View>

      {/* TF selector */}
      <View style={{flexDirection:'row',gap:6,marginBottom:12}}>
        {TFS.map(t=>(
          <Btn key={t} dark={tf===t} onPress={()=>setTf(t)} style={{flex:1,paddingVertical:8}}>
            <Text style={{fontSize:10,fontWeight:'700',color:tf===t?'#F5F4F1':C.d2}}>{t}</Text>
          </Btn>
        ))}
      </View>

      {/* Chart */}
      <Card style={{padding:10}}>
        {loading
          ?<View style={{height:H,alignItems:'center',justifyContent:'center'}}>
            <ActivityIndicator color={C.dark}/>
            <Text style={{fontSize:11,color:C.d3,marginTop:8}}>Loading candles...</Text>
          </View>
          :<Inset>
            <View style={{padding:6}}>
              <Svg width={cw-12} height={H}>
                {/* Grid */}
                {[0,1,2,3,4].map(i=>{
                  const v=lo+(rng/4)*i,y=toY(v);
                  return<G key={i}>
                    <Line x1={PL} y1={y} x2={cw-PR} y2={y} stroke={C.bord} strokeWidth="0.7" strokeDasharray="3,3"/>
                    <SvgText x={PL-3} y={y+3} fill={C.d3} fontSize="7" textAnchor="end">
                      {sym.id==='XAU'?v.toFixed(0):Math.round(v/100)*100>=10000?Math.round(v/1000)+'K':Math.round(v)}
                    </SvgText>
                  </G>;
                })}
                {/* LQ fills */}
                <Rect x={PL} y={PT} width={chartW} height={Math.max(0,toY(sym.upper)-PT)} fill="rgba(122,74,72,0.06)"/>
                <Rect x={PL} y={toY(sym.upper)} width={chartW} height={Math.max(0,toY(sym.middle)-toY(sym.upper))} fill="rgba(122,100,56,0.04)"/>
                <Rect x={PL} y={toY(sym.middle)} width={chartW} height={Math.max(0,toY(sym.lower)-toY(sym.middle))} fill="rgba(74,99,85,0.04)"/>
                <Rect x={PL} y={toY(sym.lower)} width={chartW} height={Math.max(0,PT+chartH-toY(sym.lower))} fill="rgba(58,82,114,0.06)"/>
                {/* LQ lines */}
                {toY(sym.upper)>PT&&toY(sym.upper)<PT+chartH&&<>
                  <Line x1={PL} y1={toY(sym.upper)} x2={cw-PR} y2={toY(sym.upper)} stroke={C.red} strokeWidth="1" strokeDasharray="4,3" opacity="0.7"/>
                  <SvgText x={cw-PR+2} y={toY(sym.upper)+3} fill={C.red} fontSize="7" fontWeight="700">LQ</SvgText>
                </>}
                {toY(sym.middle)>PT&&toY(sym.middle)<PT+chartH&&<>
                  <Line x1={PL} y1={toY(sym.middle)} x2={cw-PR} y2={toY(sym.middle)} stroke={C.gld} strokeWidth="1" strokeDasharray="4,3" opacity="0.7"/>
                  <SvgText x={cw-PR+2} y={toY(sym.middle)+3} fill={C.gld} fontSize="7" fontWeight="700">EQ</SvgText>
                </>}
                {toY(sym.lower)>PT&&toY(sym.lower)<PT+chartH&&<>
                  <Line x1={PL} y1={toY(sym.lower)} x2={cw-PR} y2={toY(sym.lower)} stroke={C.blu} strokeWidth="1" strokeDasharray="4,3" opacity="0.7"/>
                  <SvgText x={cw-PR+2} y={toY(sym.lower)+3} fill={C.blu} fontSize="7" fontWeight="700">SUP</SvgText>
                </>}
                {/* Candles */}
                {vis.map((cd,i)=>{
                  const x=toX(i),isUp=cd.c>=cd.o,col=isUp?C.grn:C.red;
                  const bT=toY(Math.max(cd.o,cd.c)),bB=toY(Math.min(cd.o,cd.c));
                  const bH=Math.max(1,bB-bT);
                  return<G key={i}>
                    <Line x1={x} y1={toY(cd.h)} x2={x} y2={toY(cd.l)} stroke={col} strokeWidth="1" opacity="0.8"/>
                    <Rect x={x-bw/2} y={bT} width={bw} height={bH} fill={isUp?'none':col} stroke={col} strokeWidth="1" rx="0.5"/>
                  </G>;
                })}
                {/* Current price */}
                {toY(price)>PT&&toY(price)<PT+chartH&&<G>
                  <Line x1={PL} y1={toY(price)} x2={cw-PR} y2={toY(price)} stroke={C.dark} strokeWidth="1" strokeDasharray="3,2" opacity="0.5"/>
                  <Rect x={PL-36} y={toY(price)-7} width={34} height={13} rx="3" fill={C.dark}/>
                  <SvgText x={PL-19} y={toY(price)+2} fill="#F5F4F1" fontSize="7" textAnchor="middle" fontWeight="700">{fmt(price)}</SvgText>
                </G>}
              </Svg>
            </View>
          </Inset>
        }
      </Card>

      {/* OHLC */}
      {candles.length>0&&<Card>
        <Text style={{fontSize:9,fontWeight:'700',color:C.d3,letterSpacing:2,textTransform:'uppercase',marginBottom:10}}>Last Candle [{tf}]</Text>
        <View style={{flexDirection:'row',gap:8}}>
          {[{l:'O',v:candles[candles.length-1].o,c:C.dark},{l:'H',v:candles[candles.length-1].h,c:C.grn},{l:'L',v:candles[candles.length-1].l,c:C.red},{l:'C',v:candles[candles.length-1].c,c:candles[candles.length-1].c>=candles[candles.length-1].o?C.grn:C.red}].map(x=>(
            <Inset key={x.l} style={{flex:1,padding:8,alignItems:'center'}}>
              <Text style={{fontSize:8,color:C.d3,letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>{x.l}</Text>
              <Text style={{fontSize:10,fontWeight:'700',color:x.c,fontVariant:['tabular-nums']}}>{fmt(x.v)}</Text>
            </Inset>
          ))}
        </View>
      </Card>}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ── AI PAGE ───────────────────────────────────────────────────────────────────
function AIPage({H,z,ou,sym,implVol,ouParams}){
  const regime=H>0.6?'TRENDING':H<0.4?'MEAN REVERTING':'NEUTRAL';
  const rColor=H>0.6?C.red:H<0.4?C.grn:C.gld;
  const op=ouParams||{theta:0.15,mu:sym.middle,sigma:sym.sigma,halfLife:4.6};
  const fmtV=implVol>0?implVol.toFixed(1)+'%':(Math.abs(z)*15+25).toFixed(1)+'%';
  const fmt=v=>sym.id==='XAU'?'$'+v.toFixed(2):'$'+Math.round(v).toLocaleString();
  return(
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={{fontSize:17,fontWeight:'700',color:C.dark,marginBottom:14}}>AI Signal</Text>
      <View style={[{backgroundColor:C.dark,borderRadius:22,padding:16,marginBottom:12},shadowDk]}>
        <Text style={{fontSize:9,color:'rgba(245,244,241,0.45)',letterSpacing:2,textTransform:'uppercase',marginBottom:12}}>SIGNAL SUMMARY · {sym.sub}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {[{l:'Regime',v:regime,c:rColor},{l:'Z-Score',v:(z>=0?'+':'')+z.toFixed(2)+' σ',c:Math.abs(z)>2?'#C08080':Math.abs(z)>1?'#C0A860':'#80B0A0'},{l:'Hurst H',v:H.toFixed(3),c:'#F5F4F1'},{l:'Impl Vol',v:fmtV,c:'#F5F4F1'}].map(x=>(
            <View key={x.l} style={{width:'47%',backgroundColor:'rgba(245,244,241,0.07)',borderRadius:12,padding:12,borderWidth:0.5,borderColor:'rgba(245,244,241,0.10)'}}>
              <Text style={{fontSize:8,color:'rgba(245,244,241,0.42)',letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>{x.l}</Text>
              <Text style={{fontSize:14,fontWeight:'700',color:x.c,fontVariant:['tabular-nums']}}>{x.v}</Text>
            </View>
          ))}
        </View>
      </View>
      <Card>
        <Text style={{fontSize:9,fontWeight:'700',color:C.d3,letterSpacing:2,textTransform:'uppercase',marginBottom:12}}>OU PARAMETERS (500 candles)</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {[{l:'μ Mean',v:fmt(op.mu),c:C.gld},{l:'σ Sigma',v:sym.id==='XAU'?op.sigma.toFixed(2):Math.round(op.sigma).toString(),c:C.red},{l:'θ Theta',v:op.theta.toFixed(5),c:C.grn},{l:'Half-Life',v:op.halfLife.toFixed(1)+'d',c:C.blu}].map(x=>(
            <Inset key={x.l} style={{width:'47%',padding:10,alignItems:'center'}}>
              <Text style={{fontSize:8,color:C.d3,letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>{x.l}</Text>
              <Text style={{fontSize:13,fontWeight:'700',color:x.c,fontVariant:['tabular-nums']}}>{x.v}</Text>
            </Inset>
          ))}
        </View>
      </Card>
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────
function WatchlistPage({btcPrice,xauPrice,btcChannel,xauChannel,symId,switchSym}){
  const items=[{s:SYMBOLS.BTC,price:btcPrice,ch:btcChannel},{s:SYMBOLS.XAU,price:xauPrice,ch:xauChannel}];
  return(
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={{fontSize:17,fontWeight:'700',color:C.dark,marginBottom:4}}>Watchlist</Text>
      <Text style={{fontSize:9,color:C.d3,letterSpacing:1,textTransform:'uppercase',marginBottom:14}}>LQ Channel · Real-time</Text>
      {items.map(({s,price,ch})=>{
        const active=symId===s.id;
        const fmt=v=>s.id==='XAU'?'$'+v.toFixed(2):'$'+Math.round(v).toLocaleString();
        return(
          <TouchableOpacity key={s.id} onPress={()=>switchSym(s.id)} activeOpacity={0.8}
            style={[{backgroundColor:active?C.dark:C.card,borderRadius:22,borderWidth:1,borderColor:active?C.dark:C.bord,padding:16,marginBottom:12},active?shadowDk:shadow]}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={[{width:36,height:36,borderRadius:11,backgroundColor:active?'rgba(245,244,241,0.10)':C.bg2,alignItems:'center',justifyContent:'center'},active?{}:shadowSm]}>
                  <Text style={{fontSize:s.id==='XAU'?10:15,fontWeight:'800',color:active?'#F5F4F1':s.color}}>{s.icon}</Text>
                </View>
                <View>
                  <Text style={{fontSize:13,fontWeight:'700',color:active?'#F5F4F1':C.dark}}>{s.sub}</Text>
                  <Text style={{fontSize:9,color:active?'rgba(245,244,241,0.5)':C.d3,marginTop:1}}>{s.label.split(' /')[0]}</Text>
                </View>
              </View>
              <Text style={{fontSize:15,fontWeight:'700',color:active?'#F5F4F1':C.dark,fontVariant:['tabular-nums']}}>{fmt(price)}</Text>
            </View>
            <View style={{flexDirection:'row',gap:6}}>
              {[{l:'LQ',v:ch.upper,c:C.red},{l:'EQ',v:ch.middle,c:C.gld},{l:'SUP',v:ch.lower,c:C.blu}].map((z,i)=>(
                <View key={z.l} style={{flex:1,backgroundColor:active?'rgba(245,244,241,0.07)':C.bg2,borderRadius:8,padding:6,alignItems:'center'}}>
                  <Text style={{fontSize:7.5,fontWeight:'700',color:active?'rgba(245,244,241,0.5)':z.c}}>{z.l}</Text>
                  <Text style={{fontSize:9,fontWeight:'700',color:active?'#F5F4F1':C.dark,fontVariant:['tabular-nums']}}>{s.id==='XAU'?'$'+z.v.toFixed(0):'$'+Math.round(z.v/1000)+'K'}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState('home');
  const [symId,setSymId]=useState('BTC');
  const [wsStatus,setWsStatus]=useState('CONNECTING');
  const [calibStatus,setCalibStatus]=useState('LOADING');
  const [time,setTime]=useState('9:41');
  const wsRef=useRef(null);
  const xauWsRef=useRef(null);

  const [btcPrice,setBtcPrice]=useState(75812.4);
  const [btcHist,setBtcHist]=useState(()=>Array.from({length:60},(_,i)=>65000+Math.sin(i*.2)*3000+i*50));
  const [btcOU,setBtcOU]=useState({theta:0.15,mu:74113,sigma:1300,halfLife:4.6});
  const [btcChannel,setBtcChannel]=useState({upper:81078.5,middle:74113.04,lower:67804.49});
  const [btcVol,setBtcVol]=useState(0);
  const [btcPath,setBtcPath]=useState(()=>ouSim(75812.4,74113,0.15,1300,100));

  const [xauPrice,setXauPrice]=useState(2342.85);
  const [xauHist,setXauHist]=useState(()=>Array.from({length:60},(_,i)=>2200+Math.sin(i*.15)*80+i*1.2));
  const [xauOU,setXauOU]=useState({theta:0.12,mu:2350,sigma:18,halfLife:5.8});
  const [xauChannel,setXauChannel]=useState({upper:2480,middle:2350,lower:2220});
  const [xauVol,setXauVol]=useState(0);

  const sym=SYMBOLS[symId];
  const price=symId==='BTC'?btcPrice:xauPrice;
  const hist=symId==='BTC'?btcHist:xauHist;
  const ou=symId==='BTC'?btcOU:xauOU;
  const channel=symId==='BTC'?btcChannel:xauChannel;
  const implVol=symId==='BTC'?btcVol:xauVol;
  const calibSym={...sym,...channel,sigma:ou.sigma,theta:ou.theta};

  // Clock
  useEffect(()=>{
    const id=setInterval(()=>{
      const now=new Date();
      setTime(now.getHours()+':'+String(now.getMinutes()).padStart(2,'0'));
    },30000);
    return()=>clearInterval(id);
  },[]);

  // Calibration
  useEffect(()=>{
    setCalibStatus('LOADING');
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=500')
      .then(r=>r.json()).then(data=>{
        const prices=data.map(c=>parseFloat(c[4]));
        const op=calibrateOU(prices);
        const ch=calcLQChannel(prices,op);
        setBtcOU(op);setBtcChannel(ch);setBtcVol(calcImpliedVol(prices));
        setBtcHist(prices.slice(-100));
        setBtcPath(ouSim(prices[prices.length-1],op.mu,op.theta,op.sigma,100));
        setCalibStatus('CAL ✓');
      }).catch(()=>setCalibStatus('SIM'));
    fetch('https://api.binance.com/api/v3/klines?symbol=XAUUSDT&interval=1d&limit=500')
      .then(r=>r.json()).then(data=>{
        const prices=data.map(c=>parseFloat(c[4]));
        const op=calibrateOU(prices);
        const ch=calcLQChannel(prices,op);
        setXauOU(op);setXauChannel(ch);setXauVol(calcImpliedVol(prices));
        setXauHist(prices.slice(-100));
      }).catch(()=>{});
  },[]);

  // BTC WebSocket
  useEffect(()=>{
    function connect(){
      try{
        const ws=new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
        wsRef.current=ws;
        ws.onopen=()=>setWsStatus('LIVE');
        ws.onmessage=e=>{
          try{
            const p=parseFloat(JSON.parse(e.data).p);
            if(!p||isNaN(p))return;
            setBtcPrice(p);
            setBtcHist(h=>[...h.slice(-200),p]);
          }catch(e){}
        };
        ws.onerror=()=>setWsStatus('ERROR');
        ws.onclose=()=>{setWsStatus('RETRY');setTimeout(connect,3000);};
      }catch(e){setWsStatus('ERROR');}
    }
    connect();
    return()=>{if(wsRef.current)wsRef.current.close();};
  },[]);

  // XAU WebSocket
  useEffect(()=>{
    function connect(){
      try{
        const ws=new WebSocket('wss://stream.binance.com:9443/ws/xauusdt@trade');
        xauWsRef.current=ws;
        ws.onmessage=e=>{
          try{
            const p=parseFloat(JSON.parse(e.data).p);
            if(!p||isNaN(p))return;
            setXauPrice(p);
            setXauHist(h=>[...h.slice(-200),p]);
          }catch(e){}
        };
        ws.onclose=()=>setTimeout(connect,3000);
      }catch(e){}
    }
    connect();
    return()=>{if(xauWsRef.current)xauWsRef.current.close();};
  },[]);

  const H=hurstCalc(hist.slice(-50));
  const z=(price-calibSym.middle)/(calibSym.sigma||1);
  const switchSym=id=>{setSymId(id);setPage('home');};

  const tabs=[
    {id:'home',icon:'⌂',lbl:'HOME'},
    {id:'chart',icon:'📊',lbl:'CHART'},
    {id:'watchlist',icon:'◉',lbl:'WATCH'},
    {id:'ai',icon:'◈',lbl:'AI'},
    {id:'profile',icon:'○',lbl:'ME'},
  ];

  return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>

      {/* Header */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.bord}}>
        <View style={{flexDirection:'row',gap:4}}>
          <View style={{width:22,height:2,backgroundColor:C.dark,borderRadius:2}}/>
        </View>
        <Text style={{fontFamily:'Georgia',fontSize:18,color:C.dark,fontStyle:'italic'}}>CYQONX</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <View style={[{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,backgroundColor:C.card,borderRadius:99},shadowSm]}>
            <View style={{width:5,height:5,borderRadius:3,backgroundColor:wsStatus==='LIVE'?C.grn:wsStatus==='RETRY'?C.gld:C.red}}/>
            <Text style={{fontSize:8,fontWeight:'700',color:wsStatus==='LIVE'?C.grn:wsStatus==='RETRY'?C.gld:C.red}}>{wsStatus}</Text>
          </View>
        </View>
      </View>

      {/* Symbol switcher */}
      <View style={{flexDirection:'row',gap:8,paddingHorizontal:20,paddingVertical:10}}>
        {Object.values(SYMBOLS).map(s=>(
          <Btn key={s.id} dark={symId===s.id} onPress={()=>switchSym(s.id)} style={{flex:1,paddingVertical:10,flexDirection:'row',gap:6}}>
            <Text style={{fontSize:s.id==='XAU'?10:14,color:symId===s.id?'#F5F4F1':C.d2}}>{s.icon}</Text>
            <Text style={{fontSize:12,fontWeight:'700',color:symId===s.id?'#F5F4F1':C.d2}}>{s.id}</Text>
          </Btn>
        ))}
      </View>

      {/* Page content */}
      <View style={{flex:1,paddingHorizontal:16}}>
        {page==='home'      &&<HomePage price={price} hist={hist} H={H} z={z} setPage={setPage} sym={calibSym} wsStatus={wsStatus} calibStatus={calibStatus}/>}
        {page==='chart'     &&<ChartPage sym={calibSym} price={price}/>}
        {page==='ai'        &&<AIPage H={H} z={z} ou={btcPath} sym={calibSym} implVol={implVol} ouParams={ou}/>}
        {page==='watchlist' &&<WatchlistPage btcPrice={btcPrice} xauPrice={xauPrice} btcChannel={btcChannel} xauChannel={xauChannel} symId={symId} switchSym={switchSym}/>}
        {page==='profile'   &&<ScrollView><Text style={{fontSize:17,fontWeight:'700',color:C.dark,marginBottom:16}}>Profile</Text>{[{l:'App',v:'CYQONX Terminal'},{l:'Version',v:'1.0.0'},{l:'Exchange',v:'Binance'},{l:'Model',v:'LQ Channel OU'},{l:'Data',v:'500-day calibration'}].map((x,i)=><View key={i} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:13,borderBottomWidth:1,borderBottomColor:C.bord}}><Text style={{fontSize:12,color:C.d2}}>{x.l}</Text><Text style={{fontSize:12,color:C.dark,fontWeight:'700'}}>{x.v}</Text></View>)}<View style={{height:20}}/></ScrollView>}
      </View>

      {/* Bottom Nav */}
      <View style={{flexDirection:'row',paddingBottom:8,paddingTop:8,borderTopWidth:1,borderTopColor:C.bord,backgroundColor:C.bg}}>
        {tabs.map(t=>{
          const active=page===t.id;
          return(
            <TouchableOpacity key={t.id} onPress={()=>setPage(t.id)}
              style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:4}}>
              <View style={[{width:40,height:40,borderRadius:14,backgroundColor:active?C.dark:C.card,alignItems:'center',justifyContent:'center',marginBottom:3},active?shadowDk:shadowSm]}>
                <Text style={{fontSize:16}}>{t.icon}</Text>
              </View>
              <Text style={{fontSize:8,fontWeight:active?'700':'400',color:active?C.dark:C.d3,letterSpacing:0.5}}>{t.lbl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
