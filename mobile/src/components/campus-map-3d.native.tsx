import { Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { Building, Position } from '@/lib/types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'campus-background', type: 'background', paint: { 'background-color': '#e9efe9' } }],
};

export function CampusMap3D({
  buildings,
  position,
  onSelect,
}: {
  buildings: Building[];
  position?: Position | null;
  onSelect: (code: string) => void;
}) {
  const camera = useRef<CameraRef>(null);
  const [threeD, setThreeD] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [mapNotice, setMapNotice] = useState('Loading campus map…');
  const valid = buildings.filter(item =>
    Number.isFinite(item.lat) && Number.isFinite(item.lng) &&
    Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180,
  );
  const campusCenter: [number, number] | null = valid.length
    ? [valid.reduce((n,b)=>n+b.lng,0)/valid.length, valid.reduce((n,b)=>n+b.lat,0)/valid.length]
    : null;
  const savedPosition = position &&
    Number.isFinite(position.lat) && Number.isFinite(position.lng) &&
    Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180
    ? [position.lng, position.lat] as [number, number]
    : null;
  const center: [number, number] | null = savedPosition ?? campusCenter;

  useEffect(() => {
    if (usingFallback) return;
    const timer = setTimeout(() => {
      setUsingFallback(true);
      setMapNotice('Offline map view · showing saved CampusFlow geometry only.');
    }, 8_000);
    return () => clearTimeout(timer);
  }, [usingFallback]);

  useEffect(() => {
    if (savedPosition) {
      camera.current?.easeTo({
        center: savedPosition,
        zoom: 18,
        pitch: threeD ? 58 : 0,
        bearing: threeD ? -18 : 0,
        duration: 650,
      });
    }
  }, [savedPosition?.[0], savedPosition?.[1], threeD]);

  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type:'FeatureCollection',
    features:valid.map(building => {
      const ring = (building.footprint ?? []).filter(([lng, lat]) =>
        Number.isFinite(lng) && Number.isFinite(lat) &&
        Math.abs(lng) <= 180 && Math.abs(lat) <= 90,
      );
      const hasFootprint = ring.length >= 3;
      if (hasFootprint) {
        const first = ring[0], last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      }
      return {
        type:'Feature',
        id:building.id,
        properties:{
          id:building.id,
          code:building.code,
          name:building.name,
          height_m:building.height_m,
          status:building.status,
        },
        geometry:hasFootprint
          ? {type:'Polygon',coordinates:[ring]}
          : {type:'Point',coordinates:[building.lng,building.lat]},
      };
    }),
  }), [valid]);

  const setView = (enabled: boolean) => {
    setThreeD(enabled);
    if (center) camera.current?.easeTo({ center, pitch:enabled?58:0, bearing:enabled?-18:0, duration:650 });
  };

  const handleMapFailure = () => {
    if (!usingFallback) {
      setUsingFallback(true);
      setMapNotice('Offline map view · showing saved CampusFlow geometry only.');
      return;
    }
    setMapNotice('The saved campus map could not be rendered. Check the campus coordinates and try again.');
  };

  const locate = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Location permission is needed to center the map on you.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      camera.current?.easeTo({
        center: [current.coords.longitude, current.coords.latitude],
        zoom: 18,
        pitch: threeD ? 58 : 0,
        bearing: threeD ? -18 : 0,
        duration: 650,
      });
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not read the device location.');
    } finally {
      setLocating(false);
    }
  };

  if (!center) {
    return (
      <View style={[styles.frame, styles.emptyMap]} accessibilityRole="alert">
        <Text style={styles.mapNoticeText}>Map unavailable: add a campus building coordinate or a saved position to show the map.</Text>
      </View>
    );
  }
  return <View style={styles.frame}>
    <Map
      mapStyle={usingFallback ? FALLBACK_STYLE : STYLE_URL}
      style={styles.map}
      attribution
      logo
      compass
      onDidFinishLoadingMap={() => {
        if (!usingFallback) setMapNotice('');
      }}
      onDidFailLoadingMap={handleMapFailure}
    >
      <Camera ref={camera} initialViewState={{ center, zoom:17, pitch:58, bearing:-18 }} />
      <UserLocation animated accuracy heading minDisplacement={2} />
      <GeoJSONSource id="campus-buildings" data={data} onPress={(event) => {
        const feature = event.nativeEvent.features?.[0];
        const code = feature?.properties?.code;
        if (typeof code === 'string') onSelect(code);
      }}>
        <Layer id="campus-building-footprints" type="fill" filter={['==',['geometry-type'],'Polygon']} paint={{
          'fill-color':['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#8292d8'],
          'fill-opacity':0.38,
        }} />
        <Layer id="campus-building-outlines" type="line" filter={['==',['geometry-type'],'Polygon']} paint={{
          'line-color':['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#4340e0'],
          'line-width':2,
        }} />
        <Layer id="campus-building-points" type="circle" filter={['==',['geometry-type'],'Point']} paint={{
          'circle-color':['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#4340e0'],
          'circle-radius':8,'circle-stroke-color':'#ffffff','circle-stroke-width':2,
        }} />
        <Layer id="campus-buildings-3d" type="fill-extrusion" paint={{
          'fill-extrusion-color':['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#8292d8'],
          'fill-extrusion-height':['get','height_m'], 'fill-extrusion-base':0, 'fill-extrusion-opacity':0.92,
        }} filter={['all',['==',['geometry-type'],'Polygon'],['>', ['coalesce',['get','height_m'],0],0]]} />
        <Layer id="campus-building-labels" type="symbol" layout={{
          'text-field':['concat',['get','code'],'\n',['get','name']],
          'text-size':12, 'text-anchor':'top', 'text-offset':[0,1], 'text-max-width':12,
        }} paint={{ 'text-color':'#17231c','text-halo-color':'#ffffff','text-halo-width':2 }} />
      </GeoJSONSource>
    </Map>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={threeD?'Switch to 2D plan':'Switch to 3D buildings'} onPress={()=>setView(!threeD)} style={styles.control}>
        <Ionicons name={threeD?'map-outline':'business-outline'} size={18} color={colors.brand700}/><Text style={styles.controlText}>{threeD?'2D plan':'3D buildings'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Center the campus map" onPress={()=>campusCenter && camera.current?.easeTo({center:campusCenter,zoom:17,pitch:threeD?58:0,bearing:threeD?-18:0,duration:650})} style={styles.iconControl}>
        <Ionicons name="business-outline" size={21} color={colors.ink700}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Center the map on my location" accessibilityState={{disabled:locating}} disabled={locating} onPress={()=>void locate()} style={styles.iconControl}>
        <Ionicons name="locate-outline" size={21} color={colors.ink700}/>
      </Pressable>
    </View>
    {locationError ? <View style={styles.locationNotice} accessibilityRole="alert"><Text style={styles.locationError}>{locationError}</Text></View> : null}
    {mapNotice ? <View style={styles.mapNotice} accessibilityRole="alert"><Text style={styles.mapNoticeText}>{mapNotice}</Text></View> : null}
    <View pointerEvents="none" style={styles.caption}><Text style={styles.captionTitle}>3D CAMPUS</Text><Text style={styles.captionText}> Mapped buildings · route planning uses campus paths</Text></View>
  </View>;
}

const styles=StyleSheet.create({
  frame:{height:330,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:colors.ink200,backgroundColor:'#e9efe9'},
  emptyMap:{alignItems:'center',justifyContent:'center',padding:24},
  map:{flex:1}, toolbar:{position:'absolute',left:12,top:12,flexDirection:'row',gap:8},
  control:{minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:13,borderRadius:13,backgroundColor:'rgba(255,255,255,.96)'},
  controlText:{fontSize:12,fontWeight:'800',color:colors.brand700},
  iconControl:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:'rgba(255,255,255,.96)'},
  locationNotice:{position:'absolute',left:12,right:12,bottom:64,borderRadius:12,padding:10,backgroundColor:'rgba(255,255,255,.96)'},
  locationError:{fontSize:12,color:colors.coral600},
  mapNotice:{position:'absolute',left:12,right:12,top:64,borderRadius:12,padding:10,backgroundColor:'rgba(255,255,255,.96)'},
  mapNoticeText:{fontSize:12,color:colors.ink700},
  caption:{position:'absolute',left:12,bottom:22,flexDirection:'row',alignItems:'center',borderRadius:12,paddingHorizontal:11,paddingVertical:8,backgroundColor:'rgba(15,23,42,.82)'},
  captionTitle:{fontSize:10,fontWeight:'900',color:'#fff',letterSpacing:1},captionText:{fontSize:10,color:'#fff'},
});
