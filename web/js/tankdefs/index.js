// Registry of tank types. Each file in this folder describes one tank: its gameplay data (hull, turret, gun,
// engine, fuel tanks, turret drive) and its procedural models. To add a tank: write a file like t26.js and
// list it here - parts.js, models.js and the rest of the game pick it up from TANK_DEFS.
import { PALETTES } from '../modelkit.js';
import t55 from './t55.js';
import abrams from './abrams.js';
import avre from './avre.js';
import markV from './markV.js';
import pz2 from './pz2.js';
import t26 from './t26.js';
import t44 from './t44.js';
import is2 from './is2.js';
import leo2 from './leo2.js';
import ft from './ft.js';
import vickers from './vickers.js';
import bt7 from './bt7.js';
import charb1 from './charb1.js';
import type89 from './type89.js';
import t28 from './t28.js';
import t35 from './t35.js';
import pz4 from './pz4.js';
import sherman from './sherman.js';
// armoured personnel carriers
import markIX from './markIX.js';
import sdkfz251 from './sdkfz251.js';
import btr152 from './btr152.js';
import m113 from './m113.js';
import btr80 from './btr80.js';
// cars and motorcycles
import renaultAG from './renaultAG.js';
import fordT from './fordT.js';
import gazA from './gazA.js';
import emka from './emka.js';
import horch901 from './horch901.js';
import kubel from './kubel.js';
import willys from './willys.js';
import gaz67 from './gaz67.js';
import uaz469 from './uaz469.js';
import hmmwv from './hmmwv.js';
import harleyJ from './harleyJ.js';
import triumphH from './triumphH.js';
import bmwR12 from './bmwR12.js';
import bsaM20 from './bsaM20.js';
import zundapp from './zundapp.js';
import harleyWLA from './harleyWLA.js';
import bmwR75 from './bmwR75.js';
import m72 from './m72.js';
import ural62 from './ural62.js';
import klr250 from './klr250.js';

export const TANK_DEFS = [ft, markV, vickers, t26, t28, t35, type89, pz2, bt7, charb1, sherman, pz4, t44, is2, t55, avre, leo2, abrams,
  markIX, sdkfz251, btr152, m113, btr80,
  renaultAG, fordT, gazA, emka, horch901, kubel, willys, gaz67, uaz469, hmmwv,
  harleyJ, triumphH, bmwR12, bsaM20, zundapp, harleyWLA, bmwR75, m72, ural62, klr250];
export const DEFS = Object.fromEntries(TANK_DEFS.map(d => [d.key, d]));
for (const d of TANK_DEFS) PALETTES[d.key] = d.palette;
