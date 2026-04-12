import app from "./app.js";
import { connectDB } from "./config/db.js";


const PORT = process.env.PORT || 5000;

connectDB();

// app.listen(PORT, () => {
//     console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});