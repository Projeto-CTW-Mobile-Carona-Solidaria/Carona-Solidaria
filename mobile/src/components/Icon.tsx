import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { tokens } from '../theme/tokens';

const symbols={
  search:{ios:'magnifyingglass',android:'search',web:'search'},
  rides:{ios:'person.2',android:'group',web:'group'},
  offer:{ios:'plus',android:'add',web:'add'},
  vehicle:{ios:'car',android:'directions_car',web:'directions_car'},
  profile:{ios:'person.crop.circle',android:'account_circle',web:'account_circle'},
  location:{ios:'location',android:'location_on',web:'location_on'},
  refresh:{ios:'arrow.clockwise',android:'refresh',web:'refresh'},
  back:{ios:'chevron.left',android:'arrow_back',web:'arrow_back'},
} as const;
export type IconName=keyof typeof symbols;
export function Icon({name,color=tokens.colors.navy,size=tokens.control.icon}:{name:IconName;color?:ColorValue;size?:number}){
  return <SymbolView name={symbols[name]} tintColor={color} size={size} style={{width:size,height:size}} accessible={false}/>;
}
