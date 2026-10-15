const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS y middlewares
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Conexión a Base de Datos (MongoDB Atlas)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB exitosamente'))
.catch(err => console.error('Error de conexión a MongoDB:', err));

// Esquema de la Invitación
const invitationSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  template: String,
  novios: String,
  fecha: String,
  lugar: String,
  mensaje: String,
  rsvps: [{ nombre: String, asistencia: String, personas: Number }]
});

const Invitation = mongoose.model('Invitation', invitationSchema);

// --- RUTAS ---

// 1. Página de inicio / Selección de plantillas
app.get('/', (req, res) => {
  res.render('index');
});

// 2. Formulario de creación
app.get('/crear', (req, res) => {
  const template = req.query.template || 'clasica';
  res.render('crear', { template });
});

// 3. Guardar invitación en base de datos
app.post('/crear', async (req, res) => {
  try {
    const { novios, fecha, lugar, mensaje, template } = req.body;
    const cleanSlug = novios
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);
    
    const nuevaInvitacion = new Invitation({
      slug: cleanSlug,
      template,
      novios,
      fecha,
      lugar,
      mensaje
    });

    await nuevaInvitacion.save();
    res.redirect(`/boda/${cleanSlug}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear la invitación');
  }
});

// 4. Ver invitación virtual individual
app.get('/boda/:slug', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ slug: req.params.slug });
    if (!invitation) return res.status(404).send('Invitación no encontrada');
    
    res.render('invitacion', { invitation });
  } catch (error) {
    res.status(500).send('Error al cargar la invitación');
  }
});

// 5. Procesar Confirmación de Asistencia (RSVP)
app.post('/boda/:slug/rsvp', async (req, res) => {
  try {
    const { nombre, asistencia, personas } = req.body;
    await Invitation.updateOne(
      { slug: req.params.slug },
      { $push: { rsvps: { nombre, asistencia, personas } } }
    );
    res.redirect(`/boda/${req.params.slug}?enviado=true`);
  } catch (error) {
    res.status(500).send('Error al enviar RSVP');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
