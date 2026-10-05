import { Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { Building } from '@/lib/types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const footprint = (building: Building): [number, number][] => {
  if (building.footprint && building.footprint.length >= 3) {
    const values = [...building.footprint];
    const first = values[0], last = values.at(-1)!;
    if (first[0] !== last[0] || first[1] !== last[1]) values.push(first);
    return values;
  }
  const d = 0.000055;
  return [[building.lng-d,building.lat-d],[building.lng+d,building.lat-d],[building.lng+d,building.lat+d],[building.lng-d,building.lat+d],[building.lng-d,building.lat-d]];
};

export function CampusMap3D({ buildings, onSelect }: { buildings: Building[]; onSelect: (code: string) => void }) {
  const camera = useRef<CameraRef>(null);
  const [threeD, setThreeD] = useState(true);
  const valid = buildings.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  const center: [number, number] = valid.length ? [valid.reduce((n,b)=>n+b.lng,0)/valid.length, valid.reduce((n,b)=>n+b.lat,0)/valid.length] : [11.5021,3.848];
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({ type:'FeatureCollection', features:valid.map(building => ({
    type:'Feature', id:building.id,
    properties:{ id:building.id, code:building.code, name:building.name, height:Math.max(7,(building.floor_count ?? 2)*3.4), status:building.status },
    geometry:{ type:'Polygon', coordinates:[footprint(building)] },
  })) }), [valid]);

  const setView = (enabled: boolean) => {
    setThreeD(enabled);
    camera.current?.easeTo({ center, pitch:enabled?58:0, bearing:enabled?-18:0, duration:650 });
  };

  if (!valid.length) return null;
  return <View style={styles.frame}>
    <Map mapStyle={STYLE_URL} style={styles.map} attribution logo compass>
      <Camera ref={camera} initialViewState={{ center, zoom:17, pitch:58, bearing:-18 }} />
      <UserLocation animated accuracy heading minDisplacement={2} />
      <GeoJSONSource id="campus-buildings" data={data} onPress={(event) => {
        const feature = event.nativeEvent.features?.[0];
        const code = feature?.properties?.code;
        if (typeof code === 'string') onSelect(code);
      }}>
        <Layer id="campus-buildings-3d" type="fill-extrusion" paint={{
          'fill-extrusion-color':['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#8292d8'],
          'fill-extrusion-height':['get','height'], 'fill-extrusion-base':0, 'fill-extrusion-opacity':0.92,
        }} />
        <Layer id="campus-building-labels" type="symbol" layout={{ 'text-field':['concat',['get','code'],'\n',['get','name']], 'text-size':12, 'text-anchor':'top', 'text-offset':[0,1], 'text-max-width':12 }} paint={{ 'text-color':'#17231c','text-halo-color':'#ffffff','text-halo-width':2 }} />
      </GeoJSONSource>
    </Map>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={threeD?'Switch to 2D plan':'Switch to 3D buildings'} onPress={()=>setView(!threeD)} style={styles.control}>
        <Ionicons name={threeD?'map-outline':'business-outline'} size={18} color={colors.brand700}/><Text style={styles.controlText}>{threeD?'2D plan':'3D buildings'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Center the campus map" onPress={()=>camera.current?.easeTo({center,zoom:17,pitch:threeD?58:0,bearing:threeD?-18:0,duration:650})} style={styles.iconControl}>
        <Ionicons name="locate-outline" size={21} color={colors.ink700}/>
      </Pressable>
    </View>
    <View pointerEvents="none" style={styles.caption}><Text style={styles.captionTitle}>3D CAMPUS</Text><Text style={styles.captionText}> Tap a building · location follows your device</Text></View>
  </View>;
}

const styles=StyleSheet.create({
  frame:{height:330,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:colors.ink200,backgroundColor:'#e9efe9'},
  map:{flex:1}, toolbar:{position:'absolute',left:12,top:12,flexDirection:'row',gap:8},
  control:{minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:13,borderRadius:13,backgroundColor:'rgba(255,255,255,.96)'},
  controlText:{fontSize:12,fontWeight:'800',color:colors.brand700},
  iconControl:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:'rgba(255,255,255,.96)'},
  caption:{position:'absolute',left:12,bottom:22,flexDirection:'row',alignItems:'center',borderRadius:12,paddingHorizontal:11,paddingVertical:8,backgroundColor:'rgba(15,23,42,.82)'},
  captionTitle:{fontSize:10,fontWeight:'900',color:'#fff',letterSpacing:1},captionText:{fontSize:10,color:'#fff'},
});
