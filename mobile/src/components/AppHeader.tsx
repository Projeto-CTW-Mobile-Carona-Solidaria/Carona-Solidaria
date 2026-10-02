import { Pressable,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { tokens } from '../theme/tokens';
import { Icon } from './Icon';

export function AppBar({title='Carona Solidária',onBack}:{title?:string;onBack?:()=>void}) {
  return <SafeAreaView edges={['top']} style={styles.safe}><StatusBar style="light"/><View style={styles.bar}>
    {onBack&&<Pressable accessibilityRole="button" accessibilityLabel="Voltar para Minhas caronas" onPress={onBack} style={({pressed})=>[styles.back,pressed&&{opacity:0.6}]}><Icon name="back" color={tokens.colors.white} size={20}/></Pressable>}
    <Text numberOfLines={1} style={styles.title}>{title}</Text>
  </View></SafeAreaView>;
}
export const AppHeader=AppBar;
const styles=StyleSheet.create({safe:{backgroundColor:tokens.colors.navy},bar:{height:tokens.control.appBar,paddingHorizontal:tokens.space.page,flexDirection:'row',gap:tokens.space.sm,alignItems:'center'},title:{fontSize:17,fontWeight:'600',color:tokens.colors.white,flexShrink:1},back:{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center',marginLeft:-tokens.space.md}});
