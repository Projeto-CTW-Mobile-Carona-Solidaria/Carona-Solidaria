import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { DAYS, dayLabels, type Day } from '../types';
export function Screen({children,title,subtitle}:{children:ReactNode;title:string;subtitle?:string}) {
  return <SafeAreaView style={s.safe} edges={['left','right','bottom']}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>CARONA SOLIDÁRIA</Text><Text style={s.title}>{title}</Text>{subtitle&&<Text style={s.muted}>{subtitle}</Text>}{children}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function Card({children}:{children:ReactNode}) { return <View style={s.card}>{children}</View>; }
export function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,secondary&&s.secondary,(disabled||pressed)&&{opacity:0.5}]}><Text style={[s.buttonText,secondary&&{color:colors.navy}]}>{title}</Text></Pressable>;
}
export function Field({label,...props}:TextInputProps&{label:string}) { return <View style={{gap:6}}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#667085" {...props} style={[s.input,props.style]}/></View>; }
export function Notice({text,error=false}:{text?:string;error?:boolean}) { return text?<Text accessibilityRole="alert" style={[s.notice,error&&{color:colors.danger,backgroundColor:'#FFF1F0'}]}>{text}</Text>:null; }
export function Busy() { return <ActivityIndicator color={colors.navy} size="large" style={{padding:20}}/>; }
export function Days({value,onChange,single=false}:{value:Day[];onChange:(days:Day[])=>void;single?:boolean}) {
  return <View style={s.row}>{DAYS.map(day=><Pressable key={day} accessibilityRole="checkbox" accessibilityState={{checked:value.includes(day)}} onPress={()=>onChange(single?(value.includes(day)?[]:[day]):value.includes(day)?value.filter(d=>d!==day):[...value,day])} style={[s.day,value.includes(day)&&{backgroundColor:colors.navy}]}><Text style={{color:value.includes(day)?'white':colors.navy,fontWeight:'600'}}>{dayLabels[day]}</Text></Pressable>)}</View>;
}
export const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F4F6FB'},content:{padding:20,gap:16,maxWidth:720,width:'100%',alignSelf:'center',paddingBottom:40},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:'800',color:colors.navy},title:{fontSize:30,fontWeight:'800',color:colors.navy},subtitle:{fontSize:20,fontWeight:'700',color:colors.navy},muted:{fontSize:14,lineHeight:21,color:'#526176'},label:{fontSize:14,fontWeight:'600',color:'#263B56'},card:{backgroundColor:'white',borderRadius:18,padding:20,gap:12,borderWidth:1,borderColor:'#DFE6F0'},button:{backgroundColor:colors.navy,borderRadius:12,paddingHorizontal:18,paddingVertical:14,minHeight:48,alignItems:'center',justifyContent:'center'},secondary:{backgroundColor:'#E6EDFA'},buttonText:{color:'white',fontSize:15,fontWeight:'700'},input:{backgroundColor:'white',borderColor:'#C5D0E0',borderWidth:1,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:16,color:'#182B45',minHeight:48},notice:{backgroundColor:'#E7F0FC',padding:14,borderRadius:10,color:'#17447D',lineHeight:21},row:{flexDirection:'row',flexWrap:'wrap',gap:8},day:{padding:12,minWidth:42,minHeight:44,borderRadius:10,backgroundColor:'#E6EDFA'},badge:{alignSelf:'flex-start',color:'#126B4C',backgroundColor:'#E1F3EA',paddingHorizontal:10,paddingVertical:5,borderRadius:7,fontSize:12,fontWeight:'700'}});
