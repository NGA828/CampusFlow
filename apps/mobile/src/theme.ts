import { StyleSheet } from 'react-native';

export const colours = {
  ink: '#0b1020',
  ink700: '#2b3557',
  ink500: '#6b779a',
  paper: '#f6f7fb',
  white: '#ffffff',
  brand: '#2a4bd8',
  brandSoft: '#e5eaff',
  gold: '#e0a325',
  goldSoft: '#fdf1d7',
  green: '#157f5a',
  greenSoft: '#dcf3e9',
  red: '#b22a3d',
  redSoft: '#fde4e7',
  line: '#e4e7f2',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.paper },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colours.brand, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '700', color: colours.ink, marginTop: 4 },
  subtitle: { fontSize: 14, color: colours.ink500, marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: colours.white, borderRadius: 16, borderWidth: 1, borderColor: colours.line, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colours.ink },
  muted: { fontSize: 13, color: colours.ink500, lineHeight: 19 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colours.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: colours.white, fontWeight: '700', fontSize: 15 },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cfd6ec' },
  buttonGhostText: { color: colours.ink, fontWeight: '700', fontSize: 15 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cfd6ec', borderRadius: 12, paddingHorizontal: 12, backgroundColor: colours.white, color: colours.ink },
  label: { fontSize: 13, fontWeight: '600', color: colours.ink700, marginBottom: 6 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  notice: { borderRadius: 12, padding: 12, backgroundColor: colours.brandSoft, color: '#30407f', fontSize: 13, lineHeight: 19 },
  noticeError: { backgroundColor: colours.redSoft, color: colours.red },
  noticeOk: { backgroundColor: colours.greenSoft, color: colours.green },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colours.line, backgroundColor: colours.white },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '700', color: colours.ink500 },
  tabLabelActive: { color: colours.brand },
  tabDot: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  tabDotActive: { backgroundColor: colours.brand },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colours.brandSoft,
    color: colours.brand,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '800',
    fontSize: 12,
    overflow: 'hidden',
  },
  // Floor switcher pills under the map.
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#cfd6ec', backgroundColor: colours.white, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colours.brand, borderColor: colours.brand },
  chipText: { fontSize: 12, fontWeight: '700', color: colours.ink },
  chipActiveText: { fontSize: 12, fontWeight: '700', color: colours.white },
  map: { height: 300, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colours.line },
});

export function statusColours(status: string): { backgroundColor: string; color: string } {
  if (status === 'APPROVED') return { backgroundColor: colours.greenSoft, color: colours.green };
  if (status === 'DECLINED') return { backgroundColor: colours.redSoft, color: colours.red };
  if (status === 'PENDING') return { backgroundColor: colours.goldSoft, color: '#8a6310' };
  return { backgroundColor: '#eceefa', color: colours.ink500 };
}
