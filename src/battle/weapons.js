
    export const WEAPONS = {
      pistol:  { id:"pistol",  name:"Pistol",  color:"200, 200, 210", damage:12, fireInterval:320, bulletSpeed:16, bulletRange:620, pellets:1, spread:0,    infinite:true, startAmmo:Infinity },
      smg:     { id:"smg",     name:"SMG",     color:"120, 230, 255", damage:9,  fireInterval:110, bulletSpeed:18, bulletRange:560, pellets:1, spread:0.05, startAmmo:140 },
      rifle:   { id:"rifle",   name:"Rifle",   color:"255, 200, 90",  damage:26, fireInterval:240, bulletSpeed:24, bulletRange:820, pellets:1, spread:0,    startAmmo:80 },
      shotgun: { id:"shotgun", name:"Shotgun", color:"255, 130, 90",  damage:11, fireInterval:620, bulletSpeed:17, bulletRange:360, pellets:6, spread:0.32, startAmmo:36 },
    };
    export const STARTER_WEAPON = "pistol";
    export function getWeapon(id) { return WEAPONS[id] || WEAPONS[STARTER_WEAPON]; }