# Все фичи игры в одном файле

What's done:
- T-55: a new model built in code: hull, dome turret, gun with fume extractor, road wheels that spin, fuel tanks on the right fender, drums at the rear. The player starts next to it.
- Endless road: the map is now generated in 128 m tiles around the player, forever. Near the road the land is a valley, further out there are mountains, plus lakes and forest. The old fixed 800 m map (terrain.js, vehicles.js) is removed.
- Settlements along the road:
  - villages with houses, fences and a well;
  - towns with a church and an ammo depot;
  - gas stations: park and stand still to refuel;
  - repair stations: park on the pad to get a full repair, ammo and extinguishers refilled.
- Shooting: left mouse fires, right mouse opens the gunner's sight. Shells fly on a ballistic arc and the gun compensates for drop. The turret turns and the gun elevates at a limited speed. Each tank has its own ammo count.
- Tank systems: hull, engine, transmission, turret drive, gun, ammo rack and fuel tank. Their layout differs per model (for example, the Abrams keeps its ammo in the turret bustle). A hit checks armour and angle, then damages whatever lies on the shell's path. Partial damage slows the tank, the turret or the reload; a destroyed system stops working.
- Systems on screen: a top-down diagram of the tank with coloured zones, bars for each system, a burning indicator, and ammo, reload, fuel and extinguisher counters.
- Enemies: tanks either patrol along the road or sit dug in with an earth berm around them. Hitting an enemy's fuel tank or ammo rack kills the crew; the tank stops and can be captured. A fire in the player's tank shows a countdown; F uses an extinguisher (3 per tank). If the timer runs out with the player inside, the game ends.
- Inventory:
  - Repair kits: you start with one; more lie in settlements and inside knocked-out tanks.
  - Gas torch: in the inventory from the start.
  - Cutter: must be found; the second settlement (a repair station) always has one.
  - Armour plate: carried in the hands only. One lies next to the spawn. You weld it to the hull with the torch, or cut a new one from another tank with the cutter, which damages that tank's hull by 40%.

Choices I made where the spec left room:
- "Undamaged hull" for cutting a plate means hull at 75% or more; exactly 100% would almost never happen after a fight.
- A repair kit cannot fix a system that is fully destroyed; only a repair station can.
- A penetrating hit on the crew area hurts the player (at most 55 health per hit, health slowly regenerates). The game also ends if the player's tank is destroyed or the player is killed on foot.
- Enemy fires put themselves out after about 7 seconds, so the captured tank stays usable.

Known limitations:
- The Abrams, AVRE and Mark V models are each a single mesh, so I cut their turrets off by height to make them rotate. It works for the Abrams; on the AVRE part of the turret stays on the hull. Their guns don't visibly move up and down. The Mark V has no turret; its gun just aims within a limited arc.
- I shrank the Abrams from scale 6 to 5; it was much larger than the T-55.
- Trees don't block line of sight or shells, so a tank dug in among trees can see and shoot you through the forest.
- Enemy tanks hit hard at first. I had to tone down crew damage after the player was killed by a single hit.
- I only tested hitting from a stationary tank. In one scripted run of ten shots fired on the move, none hit, so shooting while driving may be too inaccurate.

----

1. Модели. Abrams, Chieftain AVRE и Mark V построены процедурно, как Т-55. Каждая деталь — отдельный объект, поэтому артефактов при повороте башни больше нет.
- Mark V получился ромбовидным, с гусеницами вокруг корпуса и клёпаной бронёй. Его пушка стоит в шаровой установке в передней рубке и наводится в секторе ±72°. В спонсонах я поставил пулемёты: иначе чужое орудие в Mark V было бы непонятно, куда ставить.
- Статичные части я сливаю в несколько мешей, чтобы не просела производительность: около 25 вызовов отрисовки на танк вместо примерно 150.
- GLB-файлы в assets/ больше не используются, но я их не удалял.

2. Вид изнутри. V переключает вид снаружи и изнутри. У каждого танка есть отделение экипажа.
- Места: 1 — командир, 2 — наводчик, 3 — мехвод. Q — встать или сесть в ближайшее кресло. Стоя, можно ходить внутри на WASD.
- Командир управляет всем, наводчик только стреляет, мехвод только водит. ПКМ открывает прицел у наводчика и у командира.
- Мехвод смотрит в смотровую щель, командир — через смотровые блоки башенки.
- Интерьеры упрощённые: стены, кресла, рычаги, казённик орудия, боеукладка.

3. Отметины. После попадания остаются пробоины, вмятины или царапины от рикошета, в зависимости от результата. Приваренный бронелист их убирает, полный ремонт корпуса на ремпункте тоже. Отметины на башне и орудии переезжают вместе с деталью.

4. Сборка из запчастей. Смотришь на место детали у танка без экипажа:
- F снимает деталь в руки или ставит ту, что в руках. G бросает её на землю.
- Q (или F) открывает и закрывает моторный отсек. С открытым отсеком двигатель не заводится.
- С деталью в руках идёшь медленнее, с двигателем медленнее всего.

Характеристики считаются из частей: скорость по отношению мощности к весу, орудие даёт калибр, пробитие и перезарядку, баки добавляют запас топлива. Пример: Т-55 с двигателем Abrams разгоняется до потолка своей ходовой — 58 км/ч. Панель систем показывает, откуда стоит каждая деталь.

5. Кран на ремпункте. Там есть место под танк, площадки для башен №1 и №2 и пульт (F, дальше цифры 1–4). Кран снимает башню вместе с её орудием или ставит башню с площадки на корпус без башни. После снятия башни поворотный механизм вынимается руками. Механизм встаёт в любой корпус, но крутит только свою башню, иначе в панели будет «не подходит». Башни на площадках сохраняются, даже если ремпункт выгрузился из памяти.

6. Ремонт. Ремпункт не чинит двигатель, орудие, баки и поворотный механизм на 0% — их надо заменить.

Что я решил сам, скажи, если нужно иначе:
- Трансмиссия и боеукладка на 0% всё же чинятся на ремпункте. Они часть корпуса и не снимаются, так что иначе танк застрял бы навсегда.
- Где брать запчасти. На ремпунктах лежат одна-две б/у детали, а снимать их можно и со сгоревших танков.
- Снаряды при замене орудия остаются в прежнем количестве, без учёта калибра.
- Башню на Mark V поставить нельзя: у него нет погона.

---

1. Сквозь снятую башню больше нельзя пройти. Башня на подставке ремпункта теперь твёрдая, и ствол орудия тоже. Когда кран поднимает башню, коллайдеры убираются. В тесте игрок шёл прямо на башню и упёрся на краю, примерно в 1.9 м от её центра. Код в workshop.js.

2. Орудие снимается со снятой башни. Смотрите на орудие башни на подставке и нажимайте F — оно окажется в руках. С орудием в руках F на пустую башню ставит его обратно. Подсказка на экране: «F — снять: орудие Т-55 (100%)», проверил и скриншотом. Пока кран работает с этой подставкой, орудие взять нельзя.

3. Танки из укрытий больше не проваливаются под землю. У танков в укрытии была заданная заглублённость 1.1 м, и она оставалась навсегда, даже после выезда. Теперь танк вкопан только в самом укрытии и плавно поднимается на уровень земли, когда выезжает. В тесте: внутри 1.1 м, в 8 м от укрытия уже 0. Исправлено в tanks.js и ai.js.

---

Пехота и оружие (новые weapons.js, infantry.js, loot.js)
- Оружие: 60 видов, по 10 в каждом классе: пистолеты, револьверы, компактные ПП (UZI, MAC-10, Škorpion…), винтовки, автоматы (АК, M16, StG 44, ППШ, MP 40…) и пулемёты (ДП, ДТ, MG 34/42, ПКТ, M240, Bren…). Плюс 9 гранат, из них 2 противотанковые.
- Что можно нести: одно малое и одно большое оружие плюс гранаты. Патроны учитываются по калибрам. Клавиши: 1/2/3 — выбор, ЛКМ — стрелять/бросить, ПКМ — прицел, R — перезарядка, G — бросить.
- Где брать: оружие и патроны лежат в сёлах, городах, на заправках и ремпунктах, выпадают с убитых. В укладке танка появилась страница «Оружие и патроны» (цифра 6): туда можно класть и забирать оружие, патроны и гранаты.
- Враги: пехотные посты у дороги с мешками, гарнизоны в сёлах, сопровождение патрулей и засад. Солдаты стреляют очередями, бросают гранаты, противотанкисты подбегают к танку. Солдат можно давить танком, их убивают осколки снарядов и гранат.
- Пулемёт на каждом танке: стоит на турели. Снимается в поле через F (взгляд на турель) и становится твоим большим оружием; любой пулемёт можно поставить обратно. В танке X переключает орудие/пулемёт, лента питается патронами из укладки. Вражеские танки поливают из пулемёта игрока, когда он пешком.

Танки
- Новые модели: Pz.II, Т-26, Т-44, ИС-2, Leopard 2 — со всеми сменными деталями, интерьерами и местами экипажа. Кран работает и с ними.
- Порядок по боевой ценности (огонь + лобовая броня + скорость): Т-26 → Mark V → Pz.II → Т-44 → ИС-2 → Т-55 → Chieftain → Leopard 2 → Abrams. На старте стоят 2 танка, Pz.II или Т-26. Дальше по дороге враги усиливаются: Leopard 2 и Abrams встречаются примерно к 8–10 км.
- Горящий вражеский танк: экипаж с вероятностью 60% выпрыгивает и воюет пешком, пустой танк можно захватить.
- Таран дерева или дома теперь заметно тормозит, лёгкие танки сильнее. Т-26 на 31 км/ч теряет об толстое дерево примерно половину скорости.
- Топливо теперь только во внешних баках, в литрах, и переезжает вместе с баками. Взгляд на баки показывает остаток. Канистры по 20 л лежат по дороге: держишь F у танка — заливаешь.
- Мешки с песком: находятся в локациях, E кладёт мешок на танк, снимаются через укладку. Максимум 6 мешков: лоб +20 мм за мешок, борт +12 мм, масса +0.2 т. Мешки видны на броне, попадания могут их сорвать.

Мир
- Подбитая техника у дороги: частично разбитые танки с лутом в укладке и сгоревшие остовы с лутом на земле. Иногда их охраняют.
- Случайный мир в каждой игре. Номер мира показан в меню паузы и на экране конца игры, ?seed=N повторяет конкретный мир.

Что стоит знать:
- R работает двояко: при оружии в руках — перезарядка, иначе, как раньше, меню ремкомплекта.
- «Забрать патроны» из танка оставляет половину патронов калибра его пулемёта, чтобы турель не осталась пустой.
- Пули по танку дают только искры, повредить танк может лишь противотанковая граната.
- ИИ пехоты простой: укрытия не ищет.
- В балансе я исходил из того, что игрок — главный герой: пули наносят ему 50% урона. Два автоматчика с 40 м убивают стоящего игрока примерно за 30 секунд.

----

1. Infantry AI. Soldiers now take cover behind houses, sandbags, earth banks, wrecks, trees and dips in the ground. They hide and pop out to fire, and switch between standing, crouching and lying down (the model now has knees). They react to bullets flying past, hear shots, explosions and your engine, and move up in turns within the squad. They flank you when they lose sight of you, throw grenades at you in cover, run from grenades, and fall back when morale breaks. Against a tank, soldiers with anti-tank grenades close in from cover and attack from the side; the rest hide. Between fights they stand watch, sit, patrol and chat. I also stopped enemies from shooting their own men: in the first test they were killing each other through their own line.
2. Weapons. Every one of the 64 guns now has its own model (Luger, broomhandle C96, PPSh with its drum, DP with its pan magazine, water-cooled Vickers, Hotchkiss with cooling fins, SVD, and so on), and the grenades were redone too. In first person you see your hands on the weapon, and it sways while walking, lags behind the mouse, tilts when sprinting, dips on landing and when reloading.
3. Sandbags at infantry posts. Each bag in the wall can be picked up. The wall is real cover and gets lower as bags are taken.
4. Main menu. Four modes: main game (random or chosen seed), duel (your tank, 1–5 enemies, each chosen or random; a victory screen at the end), tank range (ramps, a ditch, bumps, a deep pond and a fordable one, target hulks, a repair station with the crane, a village), and loading a save. You save from the pause menu or with F5; this only works in the main game.
5. Rivers and bridges. Rivers cross the road between settlements. Bridges come in three types (wooden, steel, stone) with railings and name signs, and some shallow rivers are fords with no bridge.
6. Five pre-war tanks: Renault FT, Vickers 6-ton with two turrets, BT-7, Char B1 bis and Type 89. On the Vickers the left turret carries the machine gun and turns on its own. Two liberties you should know about:
   - The real Vickers Type A had machine guns in both turrets. I gave the right turret a 37 mm gun, as on the gun-armed twin-turret T-26, so it can fight other tanks.
   - The Char B1's 75 mm hull gun is decoration only; the working gun is the 47 mm in the turret.
7. Code structure.
   - Each tank is now one file in web/js/tankdefs/, holding both its stats and its model. Adding a tank means adding a file and listing it in index.js.
   - New modules: modelkit.js, interiors.js, weaponmodels.js, viewmodel.js, rivers.js, modes.js, menu.js, save.js, hud.js.
   - AGENTS.md is updated.
8. Interiors. Each tank's interior now differs by country and era in paint and seats, and has its own equipment list: radios, different ammo racks, internal fuel tanks, gearboxes and drive shafts, hull machine guns, screens in the modern tanks, a turret floor where the real tank has one. The Mark V's engine sits in the middle of the crew compartment, as it did historically.

--------------

1. Цвет заплаток. У бронелиста теперь есть цвет. Новые листы (в посёлках, на старте, на танкодроме) — цвета голой стали. При сварке пробоины и вмятины на танке заменяются заплатками цвета листа. Заплатки выровнены по вертикали и переезжают вместе с деталью: если перенести башню, её заплатки уедут с ней. Если на танке нет пробоин, заплатка ставится туда, куда смотрит сварщик. Ремпункт по-прежнему убирает следы попаданий, но заплатки оставляет. Цвет листа виден в подсказках, в инвентаре и в укладке танка; уложенные листы хранят свой цвет.

2. Вырезанный лист. Лист, срезанный резаком, получает текущий цвет корпуса. На месте выреза остаётся дыра — её можно заварить другим листом.

3. Баллончики с краской.
- Где найти: во дворах деревень и городов, на ремпунктах (1–2 штуки), иногда на заправках, два на танкодроме. На старте лежит один, в цвет стартового танка. Примерно половина баллончиков — в заводской краске танков, которые встречаются на этом участке дороги, остальные — белые, песочные, чёрные и т.п.
- Удерживать P: перекрашивает весь танк — корпус, башню, орудие, баки и поворотный механизм. Заплатки перекрашиваются вместе с ним, царапины исчезают. Клёпаные текстуры (FT, Mark V, Тип 89) перерисовываются в новый цвет.
- P, если смотришь на заплатку: красит только её. Этим можно подогнать цвет заплатки под корпус.
- Расход: целый танк — 25–90% баллончика в зависимости от массы, одна заплатка — 6%. Пустой баллончик выбрасывается.
- O: переключает баллончики.
- В сохранение попадают цвет танков и деталей, заплатки, цвета листов и баллончики.

4. Старт и порядок танков. Типы танков теперь идут по году появления, в один год — сначала слабый (TANK_TIERS в parts.js). Основная игра начинается с самого слабого танка — это Renault FT. Второй танк у дороги — тоже FT. Дальше по дороге: Mark V, Vickers, Т-26, Т-35, Т-28, Тип 89, БТ-7, Pz.II, Char B1, Sherman, Pz.IV, Т-44 и так далее. Прогон подтвердил: на 1,5–3 км встречаются Т-28, на 5,5–7 км — Sherman и Pz.IV.

У порядка по годам есть побочный эффект: Тип 89 (1934) слабее Т-28 и Т-35 (1933), но встречается позже них. В вашей базе у него стоит 1934 год, хотя принят он был около 1929 года. Если год исправить, он окажется рядом с Vickers.

5. Новые танки (у каждого свой файл, модели, интерьер и характеристики):
- Т-28: 76-мм КТ-28 и две малые пулемётные башни спереди, по бортам — бронеэкраны.
- Т-35: главная башня на платформе, две 45-мм и две пулемётные малые башни.
- Pz.IV Ausf. H: KwK 40 L/48 и противокумулятивные экраны (Schürzen) на корпусе и башне.
- Sherman M4A1: литой корпус, подвеска VVSS, звездообразный двигатель.

Малые башни Т-28 и Т-35 относятся к корпусу: сами доворачиваются на цель в своём секторе и поражаются как корпус, но не стреляют. Снимается краном только главная башня.

--------------

1. Patches. A patch is now shaped to the hull surface: it shrinks or shifts so it stays on one plate, bends with rounded armour, and has a low weld rim. In the screenshots nothing hangs over an edge. In very cluttered spots, such as between suspension bogies, it becomes a small flat plate, which can still stick out slightly.

2. Soldiers take free tanks. Soldiers who are already fighting take any empty, working tank within about 65 m that can still shoot (gun or machine gun). Idle soldiers only take one standing close by, such as a tank you left behind; you get the message "Противник захватил ваш …". In the test the squad took the empty tank and killed the player. Burnt-out wrecks don't count, but knocked-out ones by the road that can still shoot can be taken by alerted soldiers and become fixed firing points.

3. Tree stump. A shot below the break now cuts the stump lower, and the cut-off piece tips over and falls to the ground. This is saved with the game.

4. Network play for two players. "Сетевая игра" in the menu: co-op on the road, in a duel, or on the tank range.
- Starting: run python3 server.py; the second player then only needs a short room code. With plain http.server, the players swap an invitation code and an answer code by messenger instead.
- How it works: the host runs the enemy, damage and loot. The enemy targets whichever player is nearer. You can ride in the back of your partner's carrier. A dead player comes back next to the partner after 10 s. Saving is off in network games.
- Tested: connection, movement, soldiers, pickups, and damage to the guest's own vehicle (hull and engine hits, a wounded crew, the same hit marks on both screens).
- Not tested: an internet connection between two computers (only two game pages in one browser).
- Known gaps: the crane at the repair station isn't shared, and the host only loads the world around itself, so stay within about 1.5 km of each other.

5. Armoured personnel carriers. Five of them: Mark IX (1918), Sd.Kfz. 251 (1939), BTR-152 (1950), M113 (1960) and BTR-80 (1986). Each has its own model, crew compartment and troop seats; the wheeled ones steer with their front wheels. They have a machine gun and no main gun; I added the SGMB, Browning M2HB and KPVT for them.
- Driving or riding: E at the front puts you at the controls; E at the back puts you in the troop compartment. From there you fire your own weapon over the side, from a hatch or through a loophole — but in the M113 only from the two seats at the roof hatch. Your head sticks out there, so you can be hit.
- As the enemy: they come with tank patrols and sometimes alone, and stop to let their infantry out when they meet you.
- Where to try one: one is parked at the start of the tank range, and they are in the menu's vehicle list.

6. Soldiers go after your tank. Soldiers now stalk your tank: from cover to cover while it looks away, hiding or crawling when your turret points at them. Once close enough (about 15 m) they throw onto the engine deck. A soldier with two hand grenades ties a bundle (new "Связка гранат"), and the rest fire at the vision slits meanwhile. In the test five of them reached a Pz.II and threw five times, taking 30% off its hull.
