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

// Esquema ampliado de la Invitación
const invitationSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  novios: String,
  fecha: String,
  lugar: String,
  mapaUrl: String,          // URL o enlace del mapa de Google Maps
  mensaje: String,
  musicaUrl: String,        // Enlace de música de fondo (MP3 o YouTube stream)
  menu: String,             // Detalles del menú
  fuente: { type: String, default: 'font-serif' },       // Clase de tipografía
  colorTexto: { type: String, default: '#1c1917' },     // Color de fuente principal
  colorFondo: { type: String, default: '#fafaf9' },     // Color o estilo de fondo
  fotos: [String],          // URLs de las fotos de los novios
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

// --- RUTAS ---

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/crear', (req, res) => {
  res.render('crear');
});

// Guardar invitación con todos los campos nuevos
app.post('/crear', async (req, res) => {
  try {
    const { 
      novios, fecha, lugar, mapaUrl, mensaje, 
      musicaUrl, menu, fuente, colorTexto, colorFondo, fotos 
    } = req.body;
    
    const slug = novios.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    
    // Convertir las fotos separadas por comas en un array si vienen así
    const fotosArray = fotos ? fotos.split(',').map(f => f.trim()) : [];

    const nuevaInvitacion = new Invitation({
      slug,
      novios,
      fecha,
      lugar,
      mapaUrl,
      mensaje,
      musicaUrl,
      menu,
      fuente: fuente || 'font-serif',
      colorTexto: colorTexto || '#1c1917',
      colorFondo: colorFondo || '#fafaf9',
      fotos: fotosArray
    });

    await nuevaInvitacion.save();
    res.redirect(`/boda/${slug}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear la invitación');
  }
});

// Ver invitación virtual
app.get('/boda/:slug', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ slug: req.params.slug });
    if (!invitation) return res.status(404).send('Invitación no encontrada');
    
    res.render('invitacion', { invitation });
  } catch (error) {
    res.status(500).send('Error al cargar la invitación');
  }
});

// Procesar RSVP con Correo y Menú
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

// Procesar Buzón de Deseos
app.post('/boda/:slug/buzon', async (req, res) => {
  try {
    const { remitente, texto } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug },
      { $push: { mensajesBuzon: { remitente, texto } } }
    );
    res.redirect(`/boda/${req.params.slug}?buzon=true#buzon`);
  } catch (error) {
    res.status(500).send('Error al enviar mensaje al buzón');
  }
});

// --- PANEL DE ADMINISTRADOR ---
app.get('/boda/:slug/admin', async (req, res) => {
  try {
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
    res.redirect(`/boda/${req.params.slug}/admin`);
  } catch (error) {
    res.status(500).send('Error al asignar la mesa');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
