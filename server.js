const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bodas-app')
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error de conexión:', err));

const invitationSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  novios: String,
  fecha: String,
  fechaTexto: String,
  
  // Ubicaciones
  lugarCeremonia: String,
  mapaCeremoniaUrl: String,
  lugarRecepcion: String,
  mapaRecepcionUrl: String,

  mensaje: String,
  youtubeUrl: String,
  menu: String,
  pinAdmin: { type: String, default: '1234' },

  // Dress Code y Colores (3 colores por género)
  dressCode: { type: String, default: 'Formal Elegante' },
  coloresProhibidosDamas: [String],
  coloresProhibidosCaballeros: [String],

  // Mesa de Regalos
  zelleEmail: String,
  zelleTitular: String,
  binancePayId: String,
  binanceWalletUsdt: String,

  // Estilos
  fuente: { type: String, default: 'font-serif' },
  colorTexto: { type: String, default: '#1c1917' },
  colorFondo: { type: String, default: '#fafaf9' },
  imagenFondo: String,
  textura: { type: Boolean, default: true },
  fotos: [String],

  rsvps: [{ 
    nombre: String, 
    correo: String,
    asistencia: String, 
    personas: Number,
    menuElegido: String,
    mesa: { type: String, default: 'Sin asignar' } 
  }],
  mensajesBuzon: [{
    remitente: String,
    texto: String,
    fecha: { type: Date, default: Date.now }
  }]
});

const Invitation = mongoose.model('Invitation', invitationSchema);

// Limpieza para asegurar la extracción correcta de la URL del mapa de Google Maps
function cleanMapUrl(rawInput) {
  if (!rawInput) return '';
  if (rawInput.includes('<iframe')) {
    const match = rawInput.match(/src=["']([^"']+)["']/);
    return match ? match[1] : rawInput;
  }
  return rawInput.trim();
}

app.get('/', (req, res) => res.render('index'));
app.get('/crear', (req, res) => res.render('crear'));

app.post('/crear', async (req, res) => {
  try {
    const { 
      novios, fecha, fechaTexto, lugarCeremonia, mapaCeremoniaUrl,
      lugarRecepcion, mapaRecepcionUrl, mensaje, youtubeUrl, menu, 
      pinAdmin, dressCode, coloresDamas, coloresCaballeros,
      zelleEmail, zelleTitular, binancePayId, binanceWalletUsdt,
      fuente, colorTexto, colorFondo, imagenFondo, textura, fotos 
    } = req.body;
    
    const slug = novios.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    const fotosArray = fotos ? fotos.split(',').map(f => f.trim()) : [];
    
    // Paletas por defecto si vienen vacías
    const damasCols = coloresDamas ? coloresDamas.split(',').map(c => c.trim()) : ['#ffffff', '#f5f5dc', '#e5e7eb'];
    const cabCols = coloresCaballeros ? coloresCaballeros.split(',').map(c => c.trim()) : ['#000000', '#1f2937', '#ffffff'];

    const nuevaInvitacion = new Invitation({
      slug,
      novios,
      fecha,
      fechaTexto: fechaTexto || fecha,
      lugarCeremonia,
      mapaCeremoniaUrl: cleanMapUrl(mapaCeremoniaUrl),
      lugarRecepcion,
      mapaRecepcionUrl: cleanMapUrl(mapaRecepcionUrl),
      mensaje,
      youtubeUrl,
      menu,
      pinAdmin: pinAdmin || '1234',
      dressCode: dressCode || 'Formal Elegante',
      coloresProhibidosDamas: damasCols,
      coloresProhibidosCaballeros: cabCols,
      zelleEmail,
      zelleTitular,
      binancePayId,
      binanceWalletUsdt,
      fuente: fuente || 'font-serif',
      colorTexto: colorTexto || '#1c1917',
      colorFondo: colorFondo || '#fafaf9',
      imagenFondo,
      textura: textura === 'on',
      fotos: fotosArray
    });

    await nuevaInvitacion.save();
    res.redirect(`/boda/${slug}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear la invitación');
  }
});

app.get('/boda/:slug', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ slug: req.params.slug });
    if (!invitation) return res.status(404).send('Invitación no encontrada');
    res.render('invitacion', { invitation });
  } catch (error) {
    res.status(500).send('Error al cargar la invitación');
  }
});

app.post('/boda/:slug/rsvp', async (req, res) => {
  try {
    const { nombre, correo, asistencia, personas, menuElegido } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug },
      { $push: { rsvps: { nombre, correo, asistencia, personas, menuElegido, mesa: 'Sin asignar' } } }
    );
    res.redirect(`/boda/${req.params.slug}?enviado=true#rsvp`);
  } catch (error) {
    res.status(500).send('Error al enviar RSVP');
  }
});

app.post('/boda/:slug/buzon', async (req, res) => {
  try {
    const { remitente, texto } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug },
      { $push: { mensajesBuzon: { remitente, texto } } }
    );
    res.redirect(`/boda/${req.params.slug}?buzon=true#buzon`);
  } catch (error) {
    res.status(500).send('Error al enviar mensaje');
  }
});

app.post('/boda/:slug/admin-login', async (req, res) => {
  try {
    const { pin } = req.body;
    const invitation = await Invitation.findOne({ slug: req.params.slug });
    if (!invitation) return res.status(404).send('Invitación no encontrada');

    if (pin === invitation.pinAdmin) {
      res.redirect(`/boda/${req.params.slug}/admin?auth=ok`);
    } else {
      res.redirect(`/boda/${req.params.slug}?error=pin`);
    }
  } catch (error) {
    res.status(500).send('Error de autenticación');
  }
});

app.get('/boda/:slug/admin', async (req, res) => {
  try {
    if (req.query.auth !== 'ok') {
      return res.redirect(`/boda/${req.params.slug}?error=unauthorized`);
    }
    const invitation = await Invitation.findOne({ slug: req.params.slug });
    if (!invitation) return res.status(404).send('Invitación no encontrada');
    res.render('admin', { invitation });
  } catch (error) {
    res.status(500).send('Error al cargar el panel de administración');
  }
});

app.post('/boda/:slug/admin/mesa', async (req, res) => {
  try {
    const { rsvpId, mesa } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug, "rsvps._id": rsvpId },
      { $set: { "rsvps.$.mesa": mesa } }
    );
    res.redirect(`/boda/${req.params.slug}/admin?auth=ok`);
  } catch (error) {
    res.status(500).send('Error al asignar mesa');
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
