import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { styles } from '../theme';

/**
 * A map that cannot draw must not take the app down with it.
 *
 * MapLibre needs WebGL, and WebGL is not everywhere: an old handset, a locked-down
 * browser, a remote desktop. Without this boundary a failed renderer unmounts the
 * whole tree and the student loses the route steps too — which are the part they can
 * actually walk with.
 */
export class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={styles.cardTitle}>Carte indisponible</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Cet appareil ne peut pas afficher la carte (WebGL indisponible). Les itinéraires et les instructions
            ci-dessous restent utilisables.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
