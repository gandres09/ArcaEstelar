#!/usr/bin/env python3
# Genera el sitio de gandres09.github.io (portada, guías, referencias y novedades)
import json, sys, os, html

DATA = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
G = 'ArcaEstelar/'               # el juego
IMG = 'ArcaEstelar/tienda/'      # capturas
E = html.escape

NAV = [
    ('index.html', 'Inicio'),
    ('guia/primeros-pasos.html', 'Primeros pasos'),
    ('guia/automatizacion.html', 'Automatización'),
    ('guia/defensa.html', 'Defensa y aventura'),
    ('guia/etapas.html', 'Las tres etapas'),
    ('guia/multijugador.html', 'Con amigos'),
    ('tecnologias.html', 'Tecnologías'),
    ('edificios.html', 'Edificios'),
    ('criaturas.html', 'Criaturas'),
    ('mascotas.html', 'Mascotas'),
    ('logros.html', 'Logros'),
    ('novedades.html', 'Novedades'),
    ('preguntas.html', 'Preguntas'),
    ('acerca.html', 'Acerca'),
]

CSS = """
:root { color-scheme: dark; --bg:#0b1020; --panel:#141b2e; --line:#26304a; --ink:#dfe6f3; --muted:#9aa6bb; --accent:#f0a63a; --link:#7fb4ff; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: var(--link); }
header { background: #0e1528; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 2; }
.top { max-width: 1040px; margin: 0 auto; padding: 10px 16px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 8px; color: var(--ink); text-decoration: none; font-weight: 800; font-size: 19px; }
.brand img { width: 30px; height: 30px; border-radius: 7px; }
.play-mini { margin-left: auto; background: var(--accent); color: #1a1206; padding: 7px 14px; border-radius: 8px; font-weight: 700; text-decoration: none; }
nav { max-width: 1040px; margin: 0 auto; padding: 0 16px 8px; display: flex; gap: 4px 14px; flex-wrap: wrap; font-size: 14px; }
nav a { color: var(--muted); text-decoration: none; }
nav a.on, nav a:hover { color: var(--ink); text-decoration: underline; }
main { max-width: 860px; margin: 0 auto; padding: 28px 16px 64px; }
h1 { font-size: 32px; line-height: 1.2; margin: 6px 0 10px; }
h2 { font-size: 22px; margin: 32px 0 8px; color: #ffcf7a; }
h3 { font-size: 18px; margin: 22px 0 6px; }
.lead { font-size: 19px; color: #c9d3e6; }
.muted { color: var(--muted); font-size: 14px; }
.hero { width: 100%; border-radius: 12px; display: block; margin: 8px 0 16px; }
.shot { width: 100%; max-width: 420px; border-radius: 10px; display: block; margin: 12px auto; border: 1px solid var(--line); }
.play { display: inline-block; margin: 14px 0; padding: 13px 26px; border-radius: 10px; background: var(--accent); color: #1a1206; font-weight: 800; text-decoration: none; font-size: 18px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; margin: 14px 0; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; text-decoration: none; color: var(--ink); display: block; }
.card b { display: block; margin-bottom: 4px; }
.card span { color: var(--muted); font-size: 14px; }
.tip { background: #1b2238; border-left: 4px solid var(--accent); padding: 10px 14px; border-radius: 6px; margin: 14px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 15px; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .03em; }
.tablewrap { overflow-x: auto; }
footer { border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer div { max-width: 860px; margin: 0 auto; padding: 18px 16px 30px; }
ol li, ul li { margin: 4px 0; }
.date { color: var(--accent); font-weight: 700; }
@media (max-width: 700px) { header { position: static; } h1 { font-size: 27px; } }
"""

def page(path, title, desc, body):
    depth = path.count('/')
    up = '../' * depth
    navh = ''.join(f'<a href="{up}{h}"{" class=on" if h == path else ""}>{E(t)}</a>' for h, t in NAV)
    doc = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{E(title)} · Arca Estelar</title>
  <meta name="description" content="{E(desc)}">
  <link rel="icon" type="image/png" href="{up}{G}icons/favicon-48.png">
  <link rel="stylesheet" href="{up}estilo.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4866807668376242" crossorigin="anonymous"></script>
</head>
<body>
<header>
  <div class="top">
    <a class="brand" href="{up}index.html"><img src="{up}{G}icons/icon-192.png" alt="">Arca Estelar</a>
    <a class="play-mini" href="{up}{G}">▶ Jugar</a>
  </div>
  <nav>{navh}</nav>
</header>
<main>
{body}
</main>
<footer><div>
  Arca Estelar es un juego gratuito de fábricas, automatización y supervivencia, hecho en Argentina.
  · <a href="{up}{G}">Jugar</a> · <a href="{up}acerca.html">Acerca y contacto</a> · <a href="{up}{G}privacidad.html">Política de privacidad</a>
</div></footer>
</body>
</html>
"""
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full) or OUT, exist_ok=True)
    open(full, 'w').write(doc)

def table(head, rows):
    h = ''.join(f'<th>{E(x)}</th>' for x in head)
    r = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in row) + '</tr>' for row in rows)
    return f'<div class="tablewrap"><table><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table></div>'

T = DATA['techs']; B = DATA['buildings']
nt = len([t for t in T if not t['infinite']]); ni = len(T) - nt

# --------------------------- Inicio ---------------------------
page('index.html', 'Juego de fábricas y supervivencia', 'Arca Estelar: construí fábricas, automatizá todo y escapá del planeta. Gratis en el navegador y en Android, solo o con amigos. Guías, tecnologías y novedades.', f"""
<img class="hero" src="{IMG}portada-1024x500.png" alt="Arca Estelar: una fábrica con cintas y hornos en un planeta desconocido">
<h1>Arca Estelar</h1>
<p class="lead">Te estrellaste en un planeta que no figuraba en ningún mapa. Tenés tus manos, una Nave rota y un perrito que no se te despega. Para volver a casa vas a tener que levantar una fábrica cada vez más grande… y construir un Arca para escapar del sistema solar.</p>
<a class="play" href="{G}">▶ Jugar gratis en el navegador</a>
<p class="muted">Funciona en la compu y en el celular. No hace falta registrarse. La partida se guarda en tu dispositivo.</p>

<h2>¿De qué se trata?</h2>
<p>Arca Estelar es un juego de <b>construcción y automatización</b> con un toque de aventura y supervivencia. Empezás extrayendo piedra, hierro y carbón con la mano. Con eso armás un horno; con las placas del horno, un taladro que extrae solo; y con el tiempo, líneas de producción enteras con cintas transportadoras, brazos mecánicos, ensambladoras, trenes y robots que trabajan mientras vos explorás.</p>
<p>La fábrica contamina, y la contaminación despierta a los bichos del planeta: nidos que mandan oleadas, escupidores que atacan de lejos y gusanos que defienden su territorio. Además, lejos de la Nave hay criaturas, ruinas con cofres y guaridas con jefes. Tu personaje sube de nivel, se equipa con armas y armaduras, y tiene una mascota que pelea a su lado.</p>

<h2>Lo que vas a encontrar</h2>
<div class="cards">
  <div class="card"><b>⛏️ Extracción y fundición</b><span>Hierro, cobre, carbón, piedra, cuarzo, titanio, uranio y petróleo, cada uno en su lugar del mapa.</span></div>
  <div class="card"><b>⚙️ {len(B)} edificios</b><span>Cintas de dos carriles, brazos con filtro, ensambladoras, refinerías, trenes con señales, robots logísticos y circuitos.</span></div>
  <div class="card"><b>🔬 {nt} tecnologías</b><span>Cinco colores de ciencia y {ni} investigaciones infinitas para seguir mejorando.</span></div>
  <div class="card"><b>🛡️ Defensa</b><span>Torretas, láseres, lanzallamas, muros y un ataque orbital para limpiar el planeta.</span></div>
  <div class="card"><b>🌍 Exploración</b><span>Biomas, acantilados, clima con tormentas eléctricas, vehículos y viajes a la Luna y a Vulcano.</span></div>
  <div class="card"><b>🤝 Con amigos</b><span>En línea con un código de sala: la misma base o bases separadas, aliados o enemigos.</span></div>
</div>

<h2>Guías</h2>
<div class="cards">
  <a class="card" href="guia/primeros-pasos.html"><b>Primeros pasos</b><span>Tu primera hora: de extraer piedra a mano a tener el primer taladro funcionando.</span></a>
  <a class="card" href="guia/automatizacion.html"><b>Automatización</b><span>Cintas, brazos, electricidad, ciencia y trenes, explicados con ejemplos.</span></a>
  <a class="card" href="guia/defensa.html"><b>Defensa y aventura</b><span>Contaminación, nidos, torretas, combate, jefes y qué pasa cuando te derrotan.</span></a>
  <a class="card" href="guia/etapas.html"><b>Las tres etapas</b><span>Llegar al espacio, limpiar el planeta y armar el Arca estelar.</span></a>
  <a class="card" href="guia/multijugador.html"><b>Jugar con amigos</b><span>Cómo crear una sala, sumarse y elegir entre base compartida, aliados o enemigos.</span></a>
  <a class="card" href="tecnologias.html"><b>Todas las tecnologías</b><span>Qué pide cada investigación y qué desbloquea.</span></a>
</div>

<h2>Capturas</h2>
<img class="shot" src="{IMG}captura-1-fabrica.png" alt="Una fábrica con cintas y hornos">
<img class="shot" src="{IMG}captura-2-defensa.png" alt="Torretas defendiendo la base">

<h2>Últimas novedades</h2>
<p>El juego se actualiza seguido. Lo más reciente: mascotas nuevas (gato, conejo, zorro, Robo-perro, Dragoncito y Pingüino espacial), un botón para elegir entre ataque automático y manual, y una marca 💀 en el mapa donde te derrotaron. <a href="novedades.html">Ver todas las novedades</a>.</p>
<a class="play" href="{G}">▶ Jugar gratis</a>
""")

# --------------------------- Primeros pasos ---------------------------
page('guia/primeros-pasos.html', 'Guía: primeros pasos', 'Guía para empezar en Arca Estelar: cómo extraer a mano, armar el primer horno y el primer taladro, y llevar las placas a la Nave.', f"""
<h1>Guía: primeros pasos</h1>
<p class="lead">Tu primera hora en Arca Estelar, paso a paso. El juego también te va guiando con el cartel <b>Siguiente paso</b>, en el panel del mapa: esta guía explica el porqué de cada cosa.</p>

<h2>1. Lo básico de los controles</h2>
<ul>
  <li><b>Moverte</b>: en la compu, con W A S D o las flechas; en el celular, tocando el lugar a donde querés ir.</li>
  <li><b>La Mano ✋</b> es la herramienta principal: tocás una piedra, un mineral o un árbol y tu personaje camina hasta ahí y lo extrae. Tocás un edificio y se abre su panel.</li>
  <li><b>La barra de abajo</b> tiene los edificios agrupados por categoría (logística, producción, energía…). Elegís uno y lo ponés tocando el mapa. <b>R</b> lo gira.</li>
  <li><b>Desarmar 🗑️</b> levanta un edificio y te devuelve los materiales. <b>Ctrl+Z</b> deshace lo último.</li>
</ul>

<h2>2. Piedra y el primer horno</h2>
<p>Con la Mano, tocá una roca de <b>piedra</b> (marrón clara). Necesitás 5. Con eso ya podés poner un <b>Horno de piedra</b>: elegilo en la barra de abajo y ponelo cerca tuyo.</p>
<p>Después extraé <b>mineral de hierro</b> (gris azulado) y <b>carbón</b> (negro). Tocá el horno y usá <b>Cargar mineral</b> y <b>Cargar carbón</b>. Cuando funda, <b>Recoger</b> te pasa las placas a la mochila.</p>
<div class="tip">¿No encontrás carbón? Talá un árbol: la madera también sirve de combustible, aunque rinde menos.</div>

<h2>3. Tu primer taladro</h2>
<p>Con 10 placas de hierro ya estás para el salto más importante: el <b>Taladro</b>. Se arma con 3 placas de hierro, 3 engranajes (los hacés a mano desde el panel de fabricación) y 5 piedras.</p>
<ol>
  <li>Poné el taladro <b>sobre</b> el mineral de hierro.</li>
  <li>Girá la flecha con <b>R</b> para que apunte hacia donde querés que salga el mineral.</li>
  <li>Poné un horno <b>justo delante de la flecha</b>: el mineral cae directo adentro.</li>
  <li>Cargale carbón al taladro (1 carbón alcanza para 8 minerales) y al horno.</li>
</ol>
<p>Listo: ya no tenés que extraer hierro a mano.</p>

<h2>4. Llevar las cosas a la Nave</h2>
<p>La Nave es tu base y tu depósito. Lo que llega a la Nave queda en el inventario general, y desde ahí podés construir sin cargarlo encima (mientras estés cerca: es la <b>señal de la Nave</b>, que después se agranda investigando).</p>
<p>Para que las placas viajen solas, poné <b>Cintas</b> desde la salida del horno hasta la Nave. Las cintas tienen <b>dos carriles</b>: cada lado de la cinta lleva cosas por separado, así podés llevar, por ejemplo, hierro de un lado y cobre del otro.</p>

<h2>5. Automatizar el combustible y el cobre</h2>
<ul>
  <li>Un taladro sobre <b>carbón</b> y una cinta que pase al lado de los hornos te ahorra cargarlos a mano. Para meter el carbón en cada horno vas a necesitar <b>Brazos</b> (se investigan pronto).</li>
  <li>Armá otra línea igual para el <b>cobre</b> (mineral naranja): taladro → horno → cinta → Nave.</li>
</ul>

<h2>6. Electricidad, ensambladoras y ciencia</h2>
<p>Las máquinas avanzadas necesitan electricidad. La forma más simple al principio es un <b>Generador a carbón</b> con <b>Postes</b> que llevan la energía. Con eso funcionan las <b>Ensambladoras</b> (fabrican solas, por ejemplo engranajes) y los <b>Laboratorios</b>.</p>
<p>La <b>Ciencia roja</b> (cobre + engranaje) es la llave de todo: la llevás a un laboratorio y elegís qué investigar en <b>Investigación</b>. La primera recomendada es <b>Electrónica</b>, y después <b>Brazos</b>.</p>

<h2>Consejos para no trabarte</h2>
<ul>
  <li>Dejá espacio entre las líneas de producción: más adelante vas a querer agrandarlas.</li>
  <li>Si un taladro o un horno se queda quieto, tocalo: el panel te dice qué le falta (combustible, lugar para dejar lo que hace, energía).</li>
  <li>Los minerales valiosos (cuarzo, titanio, petróleo) están lejos de la Nave. No hace falta buscarlos al principio.</li>
  <li>Si los bichos te atacan muy pronto, podés empezar una partida en modo <b>pacífico</b> desde las opciones del mapa.</li>
</ul>
<p>Seguí con la <a href="automatizacion.html">guía de automatización</a>.</p>
""")

# --------------------------- Automatización ---------------------------
page('guia/automatizacion.html', 'Guía: automatización', 'Cómo automatizar en Arca Estelar: cintas de dos carriles, brazos, ensambladoras, electricidad, ciencia, receptores, robots y trenes.', f"""
<h1>Guía: automatización</h1>
<p class="lead">El corazón de Arca Estelar es lograr que la fábrica trabaje sola. Estas son las piezas que vas a combinar y cómo se usan.</p>

<h2>Cintas transportadoras</h2>
<p>Las cintas mueven objetos hacia donde apuntan. Cada cinta tiene <b>dos carriles</b> independientes: si una cinta entra de costado a otra, deja sus cosas en el carril más cercano. Eso permite mezclar dos materiales en una sola cinta sin que se crucen.</p>
<ul>
  <li><b>Cinta</b>, <b>Cinta rápida</b> (el doble de velocidad) y <b>Cinta exprés</b> (el cuádruple). En Vulcano hay una <b>Cinta turbo</b> todavía más rápida.</li>
  <li>El <b>Divisor</b> reparte una cinta en dos, con prioridad para un lado si querés; el <b>Filtro</b> separa un material del resto.</li>
  <li>Las <b>Cintas subterráneas</b> pasan por debajo de otras cintas o edificios.</li>
</ul>

<h2>Brazos</h2>
<p>Los brazos toman objetos de un lado y los dejan del otro: de una cinta a un horno, de una máquina a un cofre, de la Nave a un laboratorio. Hay varios tipos:</p>
<ul>
  <li><b>Brazo</b>: el básico.</li>
  <li><b>Brazo rápido</b>, <b>Brazo largo</b> (toma y deja a 2 casillas) y <b>Brazo de carga</b>, para mover mucho de una vez.</li>
  <li>A un brazo le podés poner un <b>filtro</b> desde su panel para que solo pase lo que le digas.</li>
  <li>Un brazo pegado a la <b>Nave</b> saca justo lo que necesita la máquina de enfrente. Es una forma muy cómoda de alimentar laboratorios.</li>
</ul>
<div class="tip">Se puede caminar por encima de los brazos, así que no te bloquean el paso.</div>

<h2>Electricidad</h2>
<p>Hay varias formas de generar energía, de menor a mayor potencia:</p>
<ol>
  <li><b>Generador a carbón</b>: simple, para empezar.</li>
  <li><b>Energía a vapor</b>: una <b>Bomba de agua</b> en la orilla de un lago, apuntando a una <b>Caldera</b> (con carbón), y la caldera apuntando a <b>Máquinas de vapor</b> en fila.</li>
  <li><b>Paneles solares</b> y <b>acumuladores</b>: no contaminan, pero de noche dependen de lo acumulado.</li>
  <li><b>Energía nuclear</b>: uranio enriquecido en la centrífuga, reactor, intercambiadores de calor y turbinas.</li>
</ol>
<p>La energía viaja por <b>Postes eléctricos</b>, <b>Postes medianos</b>, <b>Subestaciones</b> y <b>Torres de alta tensión</b>. Cualquier máquina eléctrica tiene que estar dentro del área de un poste.</p>

<h2>Ensambladoras y ciencia</h2>
<p>La <b>Ensambladora</b> fabrica una receta sola mientras le lleguen los ingredientes. Una cadena típica: placas de hierro → ensambladora de engranajes → ensambladora de ciencia roja → laboratorio.</p>
<p>Hay cinco colores de ciencia, y cada uno abre una parte nueva del árbol de tecnologías. Mirá la <a href="../tecnologias.html">lista completa de tecnologías</a> para planificar.</p>
<p>Los <b>módulos</b> se ponen en máquinas eléctricas y laboratorios: más velocidad, más producción o menos consumo. El <b>Faro</b> comparte el efecto de sus módulos con las máquinas de alrededor.</p>

<h2>Receptores y señal de la Nave</h2>
<p>No todo tiene que llegar hasta la Nave. Un <b>Receptor</b> puesto al final de una línea lejana manda al inventario de la Nave todo lo que le llega. Y con las investigaciones de <b>Señal de la Nave</b> y las <b>Antenas</b> podés construir con lo guardado desde más lejos.</p>

<h2>Petróleo y química</h2>
<p>Las manchas negras del mapa son pozos de <b>petróleo</b>. Con una <b>Bomba de petróleo</b>, cañerías y una <b>Refinería</b> sacás gas, aceite pesado y liviano. De ahí salen el plástico, el combustible sólido, el ácido sulfúrico y el combustible de cohete. Los <b>tanques</b> guardan líquidos y las <b>bombas</b> los empujan.</p>

<h2>Robots</h2>
<ul>
  <li><b>Robots de construcción</b>: con un <b>Puerto de robots</b> construyen los planos que dejaste esperando materiales y reconstruyen lo que rompen los bichos.</li>
  <li><b>Robots logísticos</b>: llevan cosas entre cofres de <b>provisión</b>, de <b>pedido</b>, de <b>almacenamiento</b> y de <b>búfer</b>. También te traen a vos lo que pidas en tus pedidos personales.</li>
</ul>

<h2>Trenes</h2>
<p>Para minas lejanas, nada mejor que el tren. Tendé una vía entre la mina y la base, poné una <b>Estación</b> en cada punta (una de <b>Carga</b> y otra de <b>Descarga</b>) y un <b>Tren</b> sobre la vía. Los vagones pueden ser de carga o de fluidos. Con <b>señales</b> y <b>señales en cadena</b> varios trenes comparten las mismas vías sin chocar.</p>

<h2>Circuitos</h2>
<p>Con <b>cables rojo y verde</b> y <b>combinadores</b> la fábrica puede tomar decisiones: prender una bomba solo si un tanque baja de cierto nivel, o cortar una cinta cuando un cofre se llena.</p>

<h2>Planos y la herramienta Mover</h2>
<p>Con <b>Copiar</b> guardás un pedazo de fábrica como plano y lo pegás donde quieras: los robots lo construyen. <b>Mover</b> te deja trasladar un edificio o una zona entera con sus recetas y mejoras.</p>
""")

# --------------------------- Defensa ---------------------------
bit = DATA['biters']; wr = DATA['worms']; cr = DATA['creatures']
page('guia/defensa.html', 'Guía: defensa y aventura', 'Defensa en Arca Estelar: contaminación, nidos, tipos de bichos y gusanos, torretas, combate del personaje, jefes y qué pasa al morir.', f"""
<h1>Guía: defensa y aventura</h1>
<p class="lead">El planeta no está vacío. Esta guía explica de dónde salen los enemigos, cómo defender la fábrica y cómo sobrevivir explorando.</p>

<h2>La contaminación despierta a los nidos</h2>
<p>Hornos, calderas y taladros contaminan el aire. La nube de contaminación se expande, y cuando llega a un <b>nido</b> de bichos, el nido empieza a mandar ataques hacia la fuente. Cuanto más contaminás, más grandes y frecuentes son las oleadas. Con el tiempo, los bichos además <b>evolucionan</b> (el indicador de evolución está arriba).</p>
<div class="tip">Los bosques absorben contaminación. Los hornos eléctricos y la energía solar contaminan mucho menos.</div>

<h2>Tipos de bichos</h2>
{table(['Bicho', 'Vida', 'Daño', 'Notas'], [[E(b['name']), b['hp'], b['dmg'], 'Ataca de lejos (' + str(b['range']) + ' casillas)' if b.get('range') else 'Cuerpo a cuerpo'] for b in bit])}
<h3>Gusanos</h3>
<p>Los gusanos crecen al lado de los nidos y funcionan como torretas vivas: no se mueven, pero pegan desde lejos.</p>
{table(['Gusano', 'Vida', 'Daño', 'Alcance'], [[E(w['name']), w['hp'], w['dmg'], w['range']] for w in wr])}

<h2>Cómo defender la fábrica</h2>
<ul>
  <li><b>Torretas</b> con munición: la primera defensa. La munición <b>perforante</b> y la de <b>uranio</b> hacen mucho más daño.</li>
  <li><b>Muros</b> alrededor: frenan a los bichos mientras las torretas disparan.</li>
  <li><b>Torreta láser</b>: no necesita munición, solo electricidad.</li>
  <li><b>Torreta lanzallamas</b>: ideal contra grupos grandes.</li>
  <li><b>Robots de construcción</b>: reconstruyen solos lo que se rompe.</li>
  <li>Las torretas también disparan a las criaturas salvajes que se acercan.</li>
</ul>

<h2>Tu personaje</h2>
<p>Tu personaje tiene vida, nivel y equipo. Sube de nivel peleando, y en la <b>Armería</b> fabricás armas (desde las más simples hasta un lanzacohetes) y armaduras. Las armaduras avanzadas tienen una <b>grilla de equipo</b> donde ponés escudos, baterías, paneles solares portátiles, exoesqueletos, robots personales y visión nocturna.</p>
<p>Además del arma principal tenés granadas, cápsulas de robots de combate y minas.</p>

<h3>Ataque automático o manual</h3>
<p>Arriba, al lado de tu vida, está el botón <b>⚔️ Auto</b>. En automático, tu personaje ataca solo al enemigo más cercano. Si lo pasás a <b>🎯 Manual</b>, solo ataca al enemigo que toques; así podés pasar al lado de los bichos sin ponerte a pelear. Tu mascota hace lo mismo.</p>

<h2>Criaturas, ruinas y jefes</h2>
<p>Lejos de la Nave viven criaturas salvajes, cada vez más fuertes a medida que te alejás. Hay <b>ruinas</b> con cofres de botín y <b>guaridas</b> custodiadas por jefes. Las criaturas sueltan materiales que se usan en la Armería.</p>
{table(['Criatura', 'Vida', 'Daño', 'Suelta'], [[E(c['name']) + (' <b>(jefe)</b>' if c['boss'] else ''), c['hp'], c['dmg'], E(', '.join(c['drops'])) or '—'] for c in cr])}

<h2>Si te derrotan</h2>
<p>Volvés a la Nave con la vida llena. Lo que llevabas en la mochila queda en una bolsa 🎒 donde caíste, y en el mapa aparece una marca 💀 en ese lugar, con el nombre de lo que te derrotó. Desde la lista de marcas podés tocar 🚶 para que tu personaje camine hasta ahí a recuperar tus cosas.</p>

<h2>Clima</h2>
<p>Hay lluvia, niebla y tormentas eléctricas. Los rayos pueden romper edificios: los <b>pararrayos</b> protegen 30 casillas a su alrededor, y la Nave protege su zona. De noche, la <b>linterna</b> alumbra hacia donde mirás.</p>
""")

# --------------------------- Etapas ---------------------------
page('guia/etapas.html', 'Guía: las tres etapas', 'Las tres etapas de Arca Estelar: armar la nave y llegar al espacio, limpiar el planeta y construir el Arca estelar. Además, la Luna y Vulcano.', f"""
<h1>Guía: las tres etapas</h1>
<p class="lead">Arca Estelar tiene un final. Para llegar hay que pasar por tres etapas, cada una con un objetivo claro.</p>

<h2>Etapa 1: llegar al espacio</h2>
<p>Investigá <b>Cohetería</b> y construí el <b>Astillero</b>. Ahí se arma la nave, pieza por pieza. Las piezas se le llevan por cinta o se transfieren desde su panel:</p>
<ul>{''.join(f'<li>{E(x)}</li>' for x in DATA['ship'])}</ul>
<p>Cuando esté completa, tocá el Astillero y apretá <b>Despegar</b>. Hay un logro especial si lo lográs en menos de 8 horas de juego.</p>

<h2>Etapa 2: limpiar el planeta</h2>
<p>Desde la órbita ves todo el mapa. El objetivo es dejar el aire limpio: la polución tiene que quedar debajo de la meta durante 5 minutos seguidos, y no pueden quedar nidos.</p>
<ul>
  <li>Investigá <b>Purificación del aire</b> y poné <b>Purificadores</b> con filtros donde más contaminás.</li>
  <li>Pasate a hornos eléctricos y energía limpia; los bosques ayudan.</li>
  <li>Investigá <b>Ataque orbital</b>, construí un <b>Enlace orbital</b> y cargale <b>cargas orbitales</b>: cada una borra el grupo de nidos más cercano.</li>
</ul>

<h2>Etapa 3: el Arca estelar</h2>
<p>La última nave es mucho más grande. La Nave te va haciendo pedidos y vos entregás las piezas con un botón:</p>
<ul>{''.join(f'<li>{E(x)}</li>' for x in DATA['ark'])}</ul>
<p>Cuando la termines y la lances, salís del sistema solar y terminás el juego. El final es gratis para todos.</p>

<h2>La Luna</h2>
<p>Con un cohete chico podés viajar a la Luna con tu mochila y tu mascota. Allá hay <b>regolito</b> (se funde en aleación lunar), <b>hielo</b> y <b>Helio-3</b>. Ojo: no hay oxígeno, así que nada funciona a combustión; los vehículos solo andan con combustible de cohete.</p>

<h2>Vulcano</h2>
<p>Un planeta de lava con <b>calcita</b>, <b>tungsteno</b>, una fundición especial, un taladro grande y la cinta turbo. Es una expansión opcional: no hace falta para terminar el juego.</p>

<h2>Las investigaciones infinitas</h2>
<p>Cuando terminás el árbol, quedan {ni} investigaciones que se pueden repetir para siempre, cada vez más caras, que mejoran la velocidad de investigación, la velocidad de los taladros, la productividad minera y el daño de las armas.</p>
""")

# --------------------------- Multijugador ---------------------------
page('guia/multijugador.html', 'Guía: jugar con amigos', 'Cómo jugar Arca Estelar en línea con amigos: crear una sala, entrar con un código, base compartida o bases separadas, aliados o enemigos.', f"""
<h1>Guía: jugar con amigos</h1>
<p class="lead">Arca Estelar se puede jugar en línea, sin cuentas ni servidores pagos. Uno crea la sala y los demás entran con un código.</p>

<h2>Crear una sala</h2>
<ol>
  <li>Abrí el juego y tocá <b>🌐</b> (arriba) o <b>Jugar en línea</b> desde el menú.</li>
  <li>Escribí tu nombre de jugador. Tu personaje queda asociado a ese nombre: si entrás desde otro dispositivo con el mismo nombre, volvés con tu nivel y tus cosas.</li>
  <li>Creá la sala. El juego te da un <b>código</b>: pasáselo a tus amigos.</li>
</ol>

<h2>Entrar a la sala de un amigo</h2>
<p>Tocá 🌐, escribí tu nombre y pegá el código que te pasaron. Vas a aparecer en el mundo de tu amigo.</p>

<h2>Cómo jugar juntos</h2>
<p>Al entrar elegís cómo querés jugar:</p>
<ul>
  <li><b>En la base principal</b>: todos comparten la misma Nave, el mismo inventario y la misma investigación. Es lo más simple para jugar en equipo.</li>
  <li><b>Base aliada</b>: tenés tu propia Nave, inventario e investigación, pero no se atacan.</li>
  <li><b>Base enemiga</b>: tu propia base, y las torretas y personajes de cada bando se pelean entre sí.</li>
</ul>
<p>Cada jugador puede viajar por su cuenta a la Luna o a Vulcano, sin depender de los demás.</p>

<h2>Herramientas para coordinarse</h2>
<ul>
  <li><b>Chat 💬</b> dentro del juego.</li>
  <li><b>Marcas 📍</b> en el mapa, que ven todos: minas, peligros, lugares para construir.</li>
  <li><b>¡Vengan! 📣</b>: avisa a todos dónde estás y les muestra una flecha.</li>
  <li>En el minimapa se ven tus amigos, y fuera de la pantalla aparecen flechas hacia ellos.</li>
</ul>

<h2>Una compu como servidor</h2>
<p>Si tienen una compu que queda siempre prendida, puede funcionar como servidor dedicado: guarda el mundo en disco y la fábrica sigue andando aunque nadie esté jugando. En el repositorio del juego está la guía para armarlo.</p>
<div class="tip">Las mejoras de ritmo de la tienda (velocidad x2/x3 e investigación más rápida) solo funcionan jugando solo, para que en línea todos jueguen en igualdad.</div>
""")

# --------------------------- Tecnologías ---------------------------
rows = []
for t in T:
    if t['infinite']: continue
    rows.append([f"<b>{E(t['name'])}</b><br><span class=muted>{E(t['desc'])}</span>", E(', '.join(t['packs'])) + (f" × {t['units']}" if t['units'] else ''), E(', '.join(t['req'])) or '—', E(', '.join(t['unlocks'])) or '—'])
inf = [f"<li><b>{E(t['name'])}</b>: {E(t['desc'])}</li>" for t in T if t['infinite']]
page('tecnologias.html', 'Todas las tecnologías', f'Lista completa de las {nt} tecnologías de Arca Estelar: ciencia que piden, requisitos y qué desbloquea cada una.', f"""
<h1>Todas las tecnologías</h1>
<p class="lead">Las {nt} investigaciones de Arca Estelar, en el orden en que aparecen en el árbol. Cada una pide una cantidad de paquetes de ciencia que consumen los laboratorios.</p>
<p>Consejo: no hace falta investigar todo en orden. Fijate qué te falta para el próximo objetivo (por ejemplo, <b>Cohetería</b> para la etapa 1) y seguí sus requisitos hacia atrás.</p>
{table(['Tecnología', 'Ciencia', 'Requiere', 'Desbloquea'], rows)}
<h2>Investigaciones infinitas</h2>
<ul>{''.join(inf)}</ul>
""")

# --------------------------- Edificios ---------------------------
cats = []
for b in B:
    if b['cat'] not in cats: cats.append(b['cat'])
secs = ''
for c in cats:
    rr = [[f"<b>{E(b['name'])}</b>", E(b['desc']), E(b['cost']) or '—', E(b['tech'] or 'Desde el inicio')] for b in B if b['cat'] == c]
    secs += f'<h2>{E(c.capitalize())}</h2>' + table(['Edificio', 'Para qué sirve', 'Cuesta', 'Se investiga en'], rr)
page('edificios.html', 'Todos los edificios', f'Los {len(B)} edificios de Arca Estelar por categoría: para qué sirve cada uno, cuánto cuesta y qué tecnología lo desbloquea.', f"""
<h1>Todos los edificios</h1>
<p class="lead">Los {len(B)} edificios del juego, agrupados como aparecen en la barra de abajo. Muchos se pueden mejorar en el lugar a Mk2 y Mk3 sin desarmarlos.</p>
{secs}
""")

# --------------------------- Criaturas ---------------------------
page('criaturas.html', 'Criaturas y enemigos', 'Bestiario de Arca Estelar: bichos de nido, escupidores, gusanos, criaturas salvajes y jefes, con su vida, daño y botín.', f"""
<h1>Criaturas y enemigos</h1>
<p class="lead">Todo lo que te puede atacar en el planeta, con sus números. Los valores son los de nivel 1: lejos de la Nave las criaturas son más fuertes.</p>
<h2>Bichos de nido</h2>
<p>Salen de los nidos cuando les llega la contaminación. Con la evolución aparecen las versiones más grandes.</p>
{table(['Bicho', 'Vida', 'Daño', 'Velocidad', 'Ataque'], [[E(b['name']), b['hp'], b['dmg'], b['speed'], 'De lejos, ' + str(b['range']) + ' casillas' if b.get('range') else 'Cuerpo a cuerpo'] for b in bit])}
<h2>Gusanos</h2>
{table(['Gusano', 'Vida', 'Daño', 'Alcance'], [[E(w['name']), w['hp'], w['dmg'], w['range']] for w in wr])}
<h2>Criaturas salvajes y jefes</h2>
<p>Viven lejos de la Nave y no dependen de la contaminación: si te acercás, te atacan. Los jefes custodian las guaridas.</p>
{table(['Criatura', 'Vida', 'Daño', 'Desde nivel de zona', 'Suelta'], [[E(c['name']) + (' <b>(jefe)</b>' if c['boss'] else '') + (' · ataca de lejos' if c['ranged'] else ''), c['hp'], c['dmg'], c['minL'], E(', '.join(c['drops'])) or '—'] for c in cr])}
<p>Leé la <a href="guia/defensa.html">guía de defensa</a> para saber cómo enfrentarlos.</p>
""")

# --------------------------- Mascotas ---------------------------
page('mascotas.html', 'Mascotas', 'Las mascotas de Arca Estelar: perro, gato, conejo, zorro, Robo-perro, Dragoncito y Pingüino espacial. Cómo se consiguen y cómo suben de nivel.', f"""
<h1>Mascotas</h1>
<p class="lead">Desde el primer minuto te acompaña una mascota. Te sigue a todos lados, muerde a los enemigos que se te acercan y sube de nivel con tu cariño.</p>
<h2>Especies</h2>
{table(['', 'Mascota', 'Cómo se consigue'], [[p['icon'], E(p['name']), E(p['unlock'])] for p in DATA['pets']])}
<p>La especie se elige en el <b>Guardarropa 👕</b> o en el panel de la mascota (☰ → Perrito). Al cambiar de especie se conservan el nombre, el nivel y los accesorios.</p>
<h2>Cuidarla</h2>
<ul>
  <li><b>Comida</b>: la panza se va vaciando. Alimentala cuando tenga hambre (aparece un 🦴 arriba de su cabeza).</li>
  <li><b>Cuidado</b>: si pasa mucho tiempo sin comer, se escapa. Podés adoptar otra, pero arranca en nivel 1.</li>
  <li><b>Cariño</b>: sube comiendo con hambre, con mimos y acompañándote. Con el cariño sube de nivel, hasta el 10.</li>
</ul>
<h2>Premios por nivel</h2>
<ul>
  <li>Nivel 2: un collar.</li>
  <li>Nivel 4: una medallita.</li>
  <li>Nivel 6: un pañuelo.</li>
  <li>Nivel 8: una vuelta de alegría cuando la mimás.</li>
  <li>Nivel 10: una corona dorada y un brillo especial.</li>
</ul>
<p>En línea, tus amigos ven tu mascota con su especie, su color y su nombre.</p>
""")

# --------------------------- Logros ---------------------------
page('logros.html', 'Logros', f'Los {len(DATA["ach"])} logros de Arca Estelar y cómo conseguir cada uno.', f"""
<h1>Logros</h1>
<p class="lead">Los {len(DATA['ach'])} logros del juego. Algunos desbloquean trajes y mascotas en el Guardarropa.</p>
{table(['Logro', 'Cómo se consigue'], [[f"<b>{E(a['name'])}</b>", E(a['desc'])] for a in DATA['ach']])}
""")

# --------------------------- Novedades ---------------------------
NEWS = [
  ('16 de octubre de 2026', 'Sitio con guías', ['Nuevo sitio con guías para empezar, automatizar, defenderse y jugar con amigos, y listas completas de tecnologías, edificios, criaturas y logros.']),
  ('15 de octubre de 2026', 'Mascotas, ataque manual y app de Android', [
    'Mascotas nuevas: gato y conejo gratis, zorro al llegar al espacio, y Robo-perro, Dragoncito (vuela y echa fueguito) y Pingüino espacial en el Pack de mascotas.',
    'Botón ⚔️ para elegir entre ataque automático y manual: en manual se ataca tocando al enemigo, y la mascota también espera tu orden.',
    'Cuando te derrotan, queda una marca 💀 en el mapa donde caíste, con un botón para ir hasta ahí.',
    'Guardarropa con trajes, colores de Nave y mascotas, muchos desbloqueables jugando.',
    'Regalo de la Nave cada 8 minutos: un envío con tu producción de 10 minutos o un empujón a la investigación.',
    'Versión para Android, instalable y sin conexión.',
    'Manejando un vehículo también se descubre el terreno.']),
  ('14 de octubre de 2026', 'Herramienta Mover', ['Mover un edificio o una zona entera, con sus recetas y mejoras.', 'Las torretas también disparan a las criaturas salvajes.']),
  ('8 y 9 de octubre de 2026', 'Jugar con amigos, Vulcano y más', [
    'Bases separadas en línea: cada jugador con su Nave, inventario e investigación; aliados o enemigos con combate.',
    'Cada jugador viaja por su cuenta a otros planetas.',
    'Servidor dedicado para una compu siempre prendida.',
    'Planeta Vulcano: lava, calcita, tungsteno, fundición, taladro grande y cinta turbo.',
    'Trenes avanzados con vagones de fluidos y señales en cadena.',
    'Armadura con grilla de equipo, armas del personaje, energía nuclear, circuitos, escupidores y gusanos.',
    'Mapas Grande y Enorme, biomas y acantilados.']),
  ('6 y 7 de octubre de 2026', 'Aventura y la Luna', [
    'Combate, nivel, armas y armaduras, criaturas, ruinas y jefes.',
    'Vehículos en 5 niveles, marcas compartidas en el mapa, clima con tormentas y pararrayos, linterna.',
    'Mejoras Mk2/Mk3, viaje a la Luna y pedidos de la Nave para armar el Arca.']),
]
nh = ''.join(f'<h2><span class="date">{E(d)}</span> · {E(t)}</h2><ul>' + ''.join(f'<li>{E(x)}</li>' for x in items) + '</ul>' for d, t, items in NEWS)
page('novedades.html', 'Novedades', 'Historial de cambios de Arca Estelar: mascotas, ataque manual, multijugador, Vulcano, la Luna y más.', f"""
<h1>Novedades</h1>
<p class="lead">Lo que fue cambiando en el juego, de lo más nuevo a lo más viejo.</p>
{nh}
""")

# --------------------------- Preguntas ---------------------------
FAQ = [
  ('¿Es gratis?', 'Sí. Se puede jugar de punta a punta, incluido el final, sin pagar. Hay compras opcionales (estilos, mascotas especiales, velocidad, Vulcano) y anuncios opcionales: solo aparecen si elegís mirar uno para cobrar un regalo.'),
  ('¿En qué dispositivos funciona?', 'En cualquier navegador moderno de compu o celular (Chrome, Edge, Firefox, Safari). En Android además se puede instalar como app.'),
  ('¿Dónde se guarda mi partida?', 'En tu dispositivo, en el almacenamiento del navegador o de la app. Si borrás los datos del navegador, se borra. Jugando en línea, el mundo compartido lo guarda quien creó la sala.'),
  ('¿Necesito internet?', 'Solo la primera vez que lo abrís y para jugar en línea. Después se puede jugar sin conexión.'),
  ('¿Qué lo hace distinto?', 'Además de la fábrica tiene personaje con nivel y equipo, mascotas, clima, viajes a otros planetas y un final en tres etapas.'),
  ('Los bichos me atacan demasiado, ¿qué hago?', 'Poné torretas con munición y muros antes de expandirte, y contaminá menos (hornos eléctricos, energía solar, dejar bosques). Si preferís construir tranquilo, empezá una partida en modo pacífico.'),
  ('Mi personaje pelea solo y no quiero', 'Tocá el botón ⚔️ Auto arriba para pasarlo a 🎯 Manual: solo vas a atacar a los enemigos que toques.'),
  ('¿Cómo juego con un amigo?', 'Uno crea una sala desde 🌐 y le pasa el código al otro. Está todo explicado en la guía de multijugador.'),
  ('¿El juego está en otros idiomas?', 'Por ahora está en español.'),
  ('Encontré un error, ¿dónde aviso?', 'En la página del proyecto en GitHub (el link está en Acerca). Contá qué pasó y, si podés, mandá una captura.'),
]
fh = ''.join(f'<h3>{E(q)}</h3><p>{E(a)}</p>' for q, a in FAQ)
page('preguntas.html', 'Preguntas frecuentes', 'Preguntas frecuentes sobre Arca Estelar: si es gratis, en qué dispositivos funciona, dónde se guarda la partida y cómo jugar con amigos.', f"""
<h1>Preguntas frecuentes</h1>
{fh}
<p>Más detalles en las <a href="guia/primeros-pasos.html">guías</a>.</p>
""")

# --------------------------- Acerca ---------------------------
page('acerca.html', 'Acerca y contacto', 'Quién hace Arca Estelar, cómo contactarnos y cómo apoyar el juego.', f"""
<h1>Acerca de Arca Estelar</h1>
<p class="lead">Arca Estelar es un juego independiente hecho en Argentina por un desarrollador y su grupo de amigos, que lo prueban jugando en línea casi todos los días.</p>
<p>Empezó como un juego chico de fábricas para el navegador y fue creciendo con lo que pedían los propios jugadores: el personaje con equipo, las mascotas, los viajes a otros planetas, las bases separadas para jugar con amigos. Se sigue actualizando seguido; podés ver los cambios en <a href="novedades.html">Novedades</a>.</p>
<h2>Principios</h2>
<ul>
  <li><b>Gratis de punta a punta</b>: el final del juego no se cobra.</li>
  <li><b>Sin anuncios que interrumpan</b>: solo si elegís mirar uno a cambio de un regalo.</li>
  <li><b>Sin cuentas</b>: no pedimos registrarse ni datos personales. Leé la <a href="{G}privacidad.html">política de privacidad</a>.</li>
</ul>
<h2>Contacto</h2>
<p>Para reportar errores, sugerir ideas o hacer consultas, escribinos en la página del proyecto: <a href="https://github.com/gandres09/ArcaEstelar/issues">github.com/gandres09/ArcaEstelar/issues</a>.</p>
<h2>Apoyar el juego</h2>
<p>La mejor forma de ayudar es jugarlo, compartirlo con amigos y contarnos qué te gustaría que tenga. Si querés apoyar más, en la tienda del juego está el <b>Pase Fundador</b>.</p>
""")

open(os.path.join(OUT, 'estilo.css'), 'w').write(CSS.strip() + '\n')
# Mapa del sitio para buscadores
urls = [h for h, _ in NAV]
open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>https://gandres09.github.io/{u}</loc></url>\n' for u in urls + ['ArcaEstelar/']) + '</urlset>\n')
open(os.path.join(OUT, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\nSitemap: https://gandres09.github.io/sitemap.xml\n')
print('ok', len(NAV), 'páginas')
