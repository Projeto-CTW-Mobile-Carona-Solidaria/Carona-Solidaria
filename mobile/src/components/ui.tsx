import { Children,useState,type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { Icon,type IconName } from './Icon';
import { DAYS, dayLabels, type Day } from '../types';
const {colors,space,radius,type,control}=tokens;
export function Screen({children,title,subtitle,safeTop=false}:{children:ReactNode;title:string;subtitle?:string;safeTop?:boolean}) {
  const wide=useWindowDimensions().width>=tokens.breakpoints.tablet;
  return <SafeAreaView style={s.safe} edges={safeTop?['top','left','right','bottom']:['left','right','bottom']}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={s.pageHeader}><Text style={s.eyebrow}>CARONA SOLIDÁRIA</Text><Text accessibilityRole="header" style={[s.title,wide&&{fontSize:type.desktopTitle}]}>{title}</Text>{subtitle&&<Text style={s.muted}>{subtitle}</Text>}</View>{children}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function Card({children}:{children:ReactNode}) { return <View style={s.card}>{children}</View>; }
export function Section({children,title}:{children:ReactNode;title?:string}) {
  return <View style={s.section}>{title&&<Text accessibilityRole="header" style={s.subtitle}>{title}</Text>}{children}</View>;
}
export function FormRow({children}:{children:ReactNode}) {
  const wide=useWindowDimensions().width>=tokens.breakpoints.tablet;
  return <View style={[s.formRow,wide&&{flexDirection:'row'}]}>{Children.map(children,child=><View style={wide?{flex:1}:undefined}>{child}</View>)}</View>;
}
export function Button({title,onPress,disabled=false,secondary=false,variant,icon}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;variant?:'primary'|'secondary'|'tertiary'|'danger';icon?:IconName}) {
  const [focused,setFocused]=useState(false);const wide=useWindowDimensions().width>=tokens.breakpoints.tablet;
  const kind=variant??(secondary?'secondary':'primary');const textColor=kind==='primary'?colors.white:kind==='danger'?colors.danger:colors.navy;
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={({pressed})=>[s.button,wide&&{minHeight:control.desktopButton,alignSelf:'flex-start'},kind!=='primary'&&s.secondary,kind==='tertiary'&&s.tertiary,kind==='danger'&&s.dangerButton,focused&&s.focused,(disabled||pressed)&&{opacity:0.6}]}>{icon&&<Icon name={icon} color={textColor}/>}<Text style={[s.buttonText,{color:textColor}]}>{title}</Text></Pressable>;
}
export function Field({label,...props}:TextInputProps&{label:string}) {
  const [focused,setFocused]=useState(false);
  const wide=useWindowDimensions().width>=tokens.breakpoints.tablet;
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.textSubtle} {...props} onFocus={event=>{setFocused(true);props.onFocus?.(event);}} onBlur={event=>{setFocused(false);props.onBlur?.(event);}} style={[s.input,wide&&{minHeight:control.desktopButton},focused&&s.focused,props.style]}/></View>;
}
export function Notice({text,error=false}:{text?:string;error?:boolean}) { return text?<Text accessibilityRole="alert" style={[s.notice,error&&{color:colors.danger,borderLeftColor:colors.danger}]}>{text}</Text>:null; }
export function EmptyState({text}:{text:string}) {return <Text style={s.empty}>{text}</Text>;}
export function Badge({text,tone='neutral'}:{text:string;tone?:'neutral'|'success'|'warning'|'danger'}) {
  return <Text style={[s.badge,tone==='success'&&{color:colors.success,backgroundColor:colors.successBackground},tone==='warning'&&{color:colors.warning,backgroundColor:colors.warningBackground},tone==='danger'&&{color:colors.danger,backgroundColor:colors.dangerBackground}]}>{text}</Text>;
}
export function Busy() { return <ActivityIndicator accessibilityLabel="Carregando" color={colors.navy} size="small" style={{padding:space.lg}}/>; }
export function Days({value,onChange,single=false,available=DAYS,disabled=false}:{value:Day[];onChange:(days:Day[])=>void;single?:boolean;available?:readonly Day[];disabled?:boolean}) {
  return <View style={s.days}>{DAYS.filter(day=>available.includes(day)).map(day=><Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={dayLabels[day]} accessibilityState={{checked:value.includes(day),disabled}} disabled={disabled} hitSlop={{top:4,bottom:4}} onPress={()=>onChange(single?(value.includes(day)?[]:[day]):value.includes(day)?value.filter(d=>d!==day):[...value,day])} style={({pressed})=>[s.day,value.includes(day)&&{backgroundColor:colors.navy,borderColor:colors.navy},(disabled||pressed)&&{opacity:0.6}]}><Text style={[s.dayLabel,{color:value.includes(day)?colors.white:colors.text}]}>{dayLabels[day]}</Text></Pressable>)}</View>;
}
export const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},
  content:{padding:space.page,gap:space.lg,maxWidth:tokens.layout.content,width:'100%',alignSelf:'center',paddingBottom:space.xxl},
  pageHeader:{gap:space.sm,marginBottom:space.sm,maxWidth:tokens.layout.form},
  eyebrow:{fontSize:type.caption,letterSpacing:0.7,fontWeight:'600',color:colors.textMuted},
  title:{fontSize:type.title,lineHeight:34,fontWeight:'700',color:colors.navy},
  subtitle:{fontSize:type.section,lineHeight:24,fontWeight:'600',color:colors.text},
  muted:{fontSize:type.body,lineHeight:21,color:colors.textMuted},
  helper:{fontSize:type.helper,lineHeight:18,color:colors.textSubtle},
  label:{fontSize:type.label,fontWeight:'600',color:colors.text},
  form:{gap:space.lg,width:'100%',maxWidth:tokens.layout.form},
  formRow:{gap:space.lg},field:{gap:6},
  section:{gap:space.lg,borderTopWidth:tokens.border.width,borderColor:colors.border,paddingTop:space.xl,marginTop:space.sm},
  card:{backgroundColor:colors.surface,borderRadius:radius.card,padding:space.lg,gap:space.md,borderWidth:tokens.border.width,borderColor:colors.border},
  button:{backgroundColor:colors.navy,borderWidth:1,borderColor:colors.navy,borderRadius:radius.control,paddingHorizontal:space.lg,paddingVertical:space.sm,minHeight:control.button,flexDirection:'row',gap:space.sm,alignItems:'center',justifyContent:'center'},
  secondary:{backgroundColor:'transparent',borderColor:colors.controlBorder,alignSelf:'flex-start'},
  tertiary:{borderColor:'transparent',paddingHorizontal:0},
  dangerButton:{borderColor:colors.danger,backgroundColor:'transparent'},
  buttonText:{fontSize:type.body,fontWeight:'600',flexShrink:1},
  input:{backgroundColor:colors.surface,borderColor:colors.controlBorder,borderWidth:1,borderRadius:radius.control,paddingHorizontal:space.md,paddingVertical:space.sm,fontSize:15,color:colors.text,minHeight:control.input},
  focused:{borderColor:colors.focus,outlineColor:colors.focus,outlineStyle:'solid',outlineWidth:2,outlineOffset:2},
  notice:{paddingLeft:space.md,paddingVertical:space.sm,borderLeftWidth:2,borderLeftColor:colors.controlBorder,color:colors.textMuted,fontSize:type.helper,lineHeight:19},
  empty:{color:colors.textMuted,fontSize:type.body,lineHeight:21,paddingVertical:space.lg,borderTopWidth:1,borderColor:colors.border},
  row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:space.sm},
  toolbar:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:space.sm},
  days:{flexDirection:'row',flexWrap:'wrap',gap:space.xs},
  day:{paddingHorizontal:space.sm,minWidth:36,minHeight:control.day,justifyContent:'center',alignItems:'center',borderRadius:radius.control,borderWidth:1,borderColor:colors.controlBorder,backgroundColor:colors.surface},
  dayLabel:{fontSize:type.helper,fontWeight:'600'},
  badge:{alignSelf:'flex-start',color:colors.textMuted,backgroundColor:colors.selected,paddingHorizontal:6,paddingVertical:2,borderRadius:radius.badge,fontSize:type.caption,fontWeight:'600'},
  link:{color:colors.navy,fontSize:type.body,fontWeight:'600',paddingVertical:space.md,alignSelf:'flex-start',textDecorationLine:'underline'},
  rideHeading:{gap:space.sm},rideDetails:{gap:space.xs},
  rideActions:{borderTopWidth:1,borderColor:colors.border,paddingTop:space.md,gap:space.md},
});
