const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv')
dotenv.config();

const app = express();
const port = process.env.PORT;

// Connect to MongoDB
mongoose.connect(process.env.URL_NAME);
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('Connected to MongoDB');
});

// Define student schema
const studentSchema = new mongoose.Schema({
  name: String,
  age: Number,
  grade: String,
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'Mentor' }
});

// Define mentor schema
const mentorSchema = new mongoose.Schema({
  name: String,
  subject: String,
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});

// Create models
const Student = mongoose.model('Student', studentSchema);
const Mentor = mongoose.model('Mentor', mentorSchema);

app.use(express.json());

// API to create a new mentor
app.post('/mentors', async (req, res) => {
  try {
    const mentor = await Mentor.create(req.body);
    res.status(201).json(mentor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to create a new student
app.post('/students', async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to assign a student to a mentor
app.post('/assign-mentor/:mentorId', async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.params.mentorId);
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    const students = req.body.students;
    const updatedStudents = [];

    for (const studentId of students) {
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: `Student with ID ${studentId} not found` });
      }

      if (!student.mentor) {
        student.mentor = mentor._id;
        await student.save();
        updatedStudents.push(student);
      }
    }

    mentor.students = mentor.students.concat(updatedStudents.map(student => student._id));
    await mentor.save();

    res.json({ mentor, updatedStudents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to assign or change mentor for a particular student
app.put('/assign-mentor/:studentId/:mentorId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const newMentor = await Mentor.findById(req.params.mentorId);
    if (!newMentor) {
      return res.status(404).json({ error: 'New mentor not found' });
    }

    // Unassign student from the current mentor
    if (student.mentor) {
      const currentMentor = await Mentor.findById(student.mentor);
      if (currentMentor) {
        currentMentor.students = currentMentor.students.filter(id => !id.equals(student._id));
        await currentMentor.save();
      }
    }

    // Assign student to the new mentor
    student.mentor = newMentor._id;
    await student.save();

    // Update new mentor's students array
    newMentor.students.push(student._id);
    await newMentor.save();

    res.json({ student, newMentor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to show all students for a particular mentor
app.get('/mentor-students/:mentorId', async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.params.mentorId).populate('students');
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    res.json(mentor.students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to show the previously assigned mentor for a particular student
app.get('/previous-mentor/:studentId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId).populate('mentor');
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student.mentor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
