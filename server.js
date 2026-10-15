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

  // Dress Code
  dressCode: { type: String, default: 'Formal Elegante' },
  coloresProhibidosDamas: [String],
  coloresProhibidosCaballeros: [String],

  // Regalos
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
    llevaAcompanante: Boolean,
    menuElegido: String,
    mesa: { type: String, default: 'Sin asignar' } 
  }]
});

const Invitation = mongoose.model('Invitation', invitationSchema);

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
      pinAdmin, dressCode, 
      colorDama1, colorDama2, colorDama3,
      colorCaballero1, colorCaballero2, colorCaballero3,
      zelleEmail, zelleTitular, binancePayId, binanceWalletUsdt,
      fuente, colorTexto, colorFondo, imagenFondo, textura, fotos 
    } = req.body;
    
    const slug = novios.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    
    // Procesar fotos (pueden venir como string separado por comas o array)
    let fotosArray = [];
    if (Array.isArray(fotos)) {
      fotosArray = fotos.filter(f => f.trim().length > 0);
    } else if (typeof fotos === 'string') {
      fotosArray = fotos.split(',').map(f => f.trim()).filter(f => f.length > 0);
    }

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
      coloresProhibidosDamas: [colorDama1, colorDama2, colorDama3].filter(Boolean),
      coloresProhibidosCaballeros: [colorCaballero1, colorCaballero2, colorCaballero3].filter(Boolean),
      zelleEmail,
      zelleTitular,
      binancePayId,
      binanceWalletUsdt,
      fuente: fuente || 'font-serif',
      colorTexto: colorTexto || '#1c1917',
      colorFondo: colorFondo || '#fafaf9',
      imagenFondo: imagenFondo ? imagenFondo.trim() : '',
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
    const { nombre, correo, asistencia, llevaAcompanante, menuElegido } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug },
      { $push: { rsvps: { 
          nombre, 
          correo, 
          asistencia, 
          llevaAcompanante: llevaAcompanante === 'on', 
          menuElegido, 
          mesa: 'Sin asignar' 
        } 
      } }
    );
    res.redirect(`/boda/${req.params.slug}?enviado=true#rsvp`);
  } catch (error) {
    res.status(500).send('Error al enviar RSVP');
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
