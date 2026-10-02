import { colors } from './colors';

export const tokens={
  colors,
  space:{xs:4,sm:8,md:12,lg:16,page:20,xl:24,section:32,xxl:40},
  radius:{badge:4,control:6,card:8,modal:8},
  type:{title:27,desktopTitle:30,section:18,body:14,label:13,helper:12,caption:11},
  control:{button:44,desktopButton:38,input:44,day:36,appBar:48,icon:18,tabIcon:20},
  border:{width:1},
  breakpoints:{tablet:768,desktop:1024},
  layout:{content:1040,form:680},
} as const;
