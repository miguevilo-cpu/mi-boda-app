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
  fecha: String,          // Formato ISO o texto (ej: "2026-12-31T18:00:00" para la cuenta regresiva)
  fechaTexto: String,     // Ej: "15 de Octubre, 2026 - 5:00 PM"
  lugar: String,
  mapaUrl: String,        // URL embebida de Google Maps
  mensaje: String,
  youtubeUrl: String,     // Enlace de YouTube o ID de video
  menu: String,
  fuente: { type: String, default: 'font-serif' },
  colorTexto: { type: String, default: '#1c1917' },
  colorFondo: { type: String, default: '#fafaf9' },
  imagenFondo: String,    // URL de imagen de fondo personalizada
  textura: { type: Boolean, default: true }, // Textura cartulina de hilo
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

app.get('/', (req, res) => res.render('index'));
app.get('/crear', (req, res) => res.render('crear'));

app.post('/crear', async (req, res) => {
  try {
    const { 
      novios, fecha, fechaTexto, lugar, mapaUrl, mensaje, 
      youtubeUrl, menu, fuente, colorTexto, colorFondo, imagenFondo, textura, fotos 
    } = req.body;
    
    const slug = novios.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    const fotosArray = fotos ? fotos.split(',').map(f => f.trim()) : [];

    const nuevaInvitacion = new Invitation({
      slug,
      novios,
      fecha,          // Útil para la cuenta regresiva (ej. "2026-12-15T17:00:00")
      fechaTexto: fechaTexto || fecha,
      lugar,
      mapaUrl,
      mensaje,
      youtubeUrl,
      menu,
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

// Panel de Administrador
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
    res.status(500).send('Error al asignar mesa');
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
