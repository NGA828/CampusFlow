import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MobileRouteLeg } from '@/lib/api';

const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'route-background', type: 'background', paint: { 'background-color': '#e9efe9' } }],
};

/** Real-world outdoor route view; indoor floor legs remain in the surveyed floor-plan trace. */
export function RouteMap3D({ legs }: { legs: MobileRouteLeg[] }) {
  const [usingFallback, setUsingFallback] = useState(false);
  const [mapNotice, setMapNotice] = useState('');
  useEffect(() => {
    if (usingFallback) return;
    const timer = setTimeout(() => {
      setUsingFallback(true);
      setMapNotice('Offline route view · saved route geometry only.');
    }, 8_000);
    return () => clearTimeout(timer);
  }, [usingFallback]);

  const handleMapFailure = () => {
    if (!usingFallback) {
      setUsingFallback(true);
      setMapNotice('Offline route view · saved route geometry only.');
      return;
    }
    setMapNotice('The route map could not be rendered. The authoritative route steps remain available below.');
  };

  const outdoor=legs.filter(leg=>!leg.floor_id && leg.geo.length>1);
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = outdoor.map((leg,index)=>({
    type:'Feature',properties:{index},geometry:{type:'LineString',coordinates:leg.geo.map(point=>[point.lng,point.lat])},
  }));
  const coordinates=features.flatMap(feature=>feature.geometry.coordinates);
  if(!coordinates.length)return null;
  const lngs=coordinates.map(point=>point[0]),lats=coordinates.map(point=>point[1]);
  const bounds: [number,number,number,number]=[Math.min(...lngs),Math.min(...lats),Math.max(...lngs),Math.max(...lats)];
  return <View style={styles.frame} accessibilityLabel="Interactive 3D outdoor route map">
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
      <Camera initialViewState={{bounds,padding:{top:45,right:35,bottom:45,left:35},pitch:55,bearing:-16}} />
      <UserLocation animated accuracy heading minDisplacement={2}/>
      <GeoJSONSource id="navigation-route" data={{type:'FeatureCollection',features}}>
        <Layer id="route-casing" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#ffffff','line-width':9,'line-opacity':0.92}}/>
        <Layer id="route-line" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#2458b8','line-width':5}}/>
      </GeoJSONSource>
    </Map>
    {mapNotice ? <View style={styles.notice} accessibilityRole="alert"><Text style={styles.noticeText}>{mapNotice}</Text></View> : null}
  </View>;
}
const styles=StyleSheet.create({frame:{height:300,borderRadius:18,overflow:'hidden',backgroundColor:'#e9efe9'},map:{flex:1},notice:{position:'absolute',left:12,right:12,top:12,borderRadius:12,padding:10,backgroundColor:'rgba(255,255,255,.96)'},noticeText:{fontSize:12,color:'#17231c'}});
