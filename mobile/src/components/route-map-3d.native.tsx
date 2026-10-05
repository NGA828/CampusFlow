import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import type { MobileRouteLeg } from '@/lib/api';

const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';

/** Real-world outdoor route view; indoor floor legs remain in the surveyed floor-plan trace. */
export function RouteMap3D({ legs }: { legs: MobileRouteLeg[] }) {
  const outdoor=legs.filter(leg=>!leg.floor_id && leg.geo.length>1);
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = outdoor.map((leg,index)=>({
    type:'Feature',properties:{index},geometry:{type:'LineString',coordinates:leg.geo.map(point=>[point.lng,point.lat])},
  }));
  const coordinates=features.flatMap(feature=>feature.geometry.coordinates);
  if(!coordinates.length)return null;
  const lngs=coordinates.map(point=>point[0]),lats=coordinates.map(point=>point[1]);
  const bounds: [number,number,number,number]=[Math.min(...lngs),Math.min(...lats),Math.max(...lngs),Math.max(...lats)];
  return <View style={styles.frame} accessibilityLabel="Interactive 3D outdoor route map">
    <Map mapStyle={STYLE_URL} style={styles.map} attribution logo compass>
      <Camera initialViewState={{bounds,padding:{top:45,right:35,bottom:45,left:35},pitch:55,bearing:-16}} />
      <UserLocation animated accuracy heading minDisplacement={2}/>
      <GeoJSONSource id="navigation-route" data={{type:'FeatureCollection',features}}>
        <Layer id="route-casing" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#ffffff','line-width':9,'line-opacity':0.92}}/>
        <Layer id="route-line" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#2458b8','line-width':5}}/>
      </GeoJSONSource>
    </Map>
  </View>;
}
const styles=StyleSheet.create({frame:{height:300,borderRadius:18,overflow:'hidden',backgroundColor:'#e9efe9'},map:{flex:1}});
