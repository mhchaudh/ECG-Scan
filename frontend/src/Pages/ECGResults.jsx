import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Container, Typography, Paper, Box, Radio, RadioGroup, FormControlLabel, TextField, Button, List, ListItem, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from "@mui/material";
import './ECGResults.css';

// use indexeddb instead of localstorage
const initializeDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ECGAppDB'); 

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // create all the object stores needed
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'uniqueId' });
        historyStore.createIndex('byDate', 'dateTime', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('identifiers')) {
        db.createObjectStore('identifiers', { keyPath: 'identifier' });
      }
      
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'uniqueId' });
      }
      
      if (!db.objectStoreNames.contains('classificationResults')) {
        db.createObjectStore('classificationResults', { keyPath: 'uniqueId' });
      }
      
      if (!db.objectStoreNames.contains('feedback')) {
        db.createObjectStore('feedback', { keyPath: 'uniqueId' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

const ECGResults = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const uniqueId = searchParams.get("uniqueId");
  const filename = searchParams.get("filename");
  const identifier = searchParams.get("identifier");
  const age = searchParams.get("age");
  const gender = searchParams.get("gender");

  const [classificationResult, setClassificationResult] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [highlightedImageUrl, setHighlightedImageUrl] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [otherFeedback, setOtherFeedback] = useState("");
  const [submittedFeedback, setSubmittedFeedback] = useState(false);
  const [selectedColorImage, setSelectedColorImage] = useState(null);
  const [showColorPopup, setShowColorPopup] = useState(false);
  const [loadingColor, setLoadingColor] = useState(false);
  const [db, setDb] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || "";
  const colorOptions = ["#2196F3", "#FFEB3B", "#F44336", "#4CAF50", "#9C27B0"];

  const [isDarkMode, setIsDarkMode] = useState(
    location.state?.darkMode ?? document.body.classList.contains("dark-mode")
  );

  // check for changes in dark mode
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains("dark-mode"));
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // initialize the db 
  useEffect(() => {
    const initDB = async () => {
      try {
        const database = await initializeDB();
        setDb(database);
        
        // check if all required objects exist
        if (!database.objectStoreNames.contains('classificationResults') || 
            !database.objectStoreNames.contains('images') ||
            !database.objectStoreNames.contains('feedback')) {
          throw new Error('Required object stores missing');
        }
        
        await loadData(database);
      } catch (error) {
        console.error("Database initialization failed:", error);
        // recover if needed
        try {
          indexedDB.deleteDatabase('ECGAppDB');
          const newDB = await initializeDB();
          setDb(newDB);
        } catch (recoveryError) {
          console.error("Recovery failed:", recoveryError);
        }
      }
    };

    initDB();

    // Dark mode check
    setIsDarkMode(document.body.classList.contains("dark-mode"));
  }, []);

  const handleColorBoxClick = async (color) => {
    if (!db) return;
  
    setLoadingColor(true);
    
    try {
      const [originalImageData, highlightedImageData] = await Promise.all([
        getFromDB(db, 'images', `${uniqueId}_original`),
        getFromDB(db, 'images', `${uniqueId}_bbox`)
      ]);
  
      if (!originalImageData?.imageData) {
        throw new Error("Original ECG image not found");
      }
      if (!highlightedImageData?.boxes) {
        throw new Error("ECG highlight data not found");
      }
  
      const blob = await (await fetch(originalImageData.imageData)).blob();
      const imageFile = new File([blob], "ecg_original.png", { type: "image/png" });
  
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('boxes', JSON.stringify(highlightedImageData.boxes));
      formData.append('color', color);
      console.log(highlightedImageData.boxes);
      console.log(color);

  
      const response = await fetch(`${API_URL}/api/single-box-image`, {
        method: "POST",
        body: formData
      });
  
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to process image");
      }
  
      const result = await response.json();
      setSelectedColorImage(result.image);
      setShowColorPopup(true);
  
    } catch (error) {
      console.error("Color highlight failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoadingColor(false);
    }
  };
  const loadData = async (database) => {
    if (!uniqueId || !database) return;
  
    try {
      const [
        classification, 
        image, 
        savedFeedback, 
        historyItem, 
        boundedBoxImage,
        originalBoundedBoxImage
      ] = await Promise.all([
        getFromDB(database, 'classificationResults', uniqueId),
        getFromDB(database, 'images', uniqueId),
        getFromDB(database, 'feedback', uniqueId),
        getFromDB(database, 'history', uniqueId),
        getFromDB(database, 'images', `${uniqueId}_bbox`),
        getFromDB(database, 'images', `${uniqueId}_original`)
      ]);
  
      // check if both the images exist
      if (!boundedBoxImage || !originalBoundedBoxImage) {
        throw new Error("Missing required image data in database");
      }
  
      setClassificationResult(classification?.result || null);
      setImageUrl(image?.imageData || null);
      setHighlightedImageUrl(boundedBoxImage?.imageData || null); // set the bounded box image
  
      if (savedFeedback) {
        setFeedback(savedFeedback.feedback);
        setSubmittedFeedback(true);
      }
  
      if (!historyItem) {
        setSubmittedFeedback(false);
        setFeedback("");
        setOtherFeedback("");
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // get from indexeddb
  const getFromDB = (database, storeName, key) => {
    return new Promise((resolve, reject) => {
      try {
        if (!database.objectStoreNames.contains(storeName)) {
          throw new Error(`Object store ${storeName} not found`);
        }

        const transaction = database.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      } catch (error) {
        reject(error);
      }
    });
  };


  const handleSubmitFeedback = async () => {
    if (!db) return;
    
    const finalFeedback = feedback === "Other" ? otherFeedback : feedback;

    try {
      // send feedback to server
      const feedbackData = {
        feedback: finalFeedback,
        filename: filename,
        identifier: identifier,
        age: age,
        gender: gender,
      };

      const response = await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.statusText}`);
      }

      // save the feedback to indexeddb
      await saveFeedbackToDB(db, uniqueId, finalFeedback);

      setFeedback(finalFeedback);
      setSubmittedFeedback(true);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  // save the feedback to indexeddb
  const saveFeedbackToDB = (database, uniqueId, feedback) => {
    return new Promise((resolve, reject) => {
      try {
        if (!database.objectStoreNames.contains('feedback')) {
          throw new Error('Feedback store not found');
        }

        const transaction = database.transaction(['feedback'], 'readwrite');
        const store = transaction.objectStore('feedback');
        const request = store.put({ uniqueId, feedback });

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      } catch (error) {
        reject(error);
      }
    });
  };

  if (!classificationResult || !imageUrl) {
    return (
      <Container sx={{ mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom color="text.primary">
            ECG Classification Results
          </Typography>
          <Typography variant="body1" color="text.primary">
            No results available. Please try again.
          </Typography>
        </Paper>
      </Container>
    );
  }
  const sortedDiagnosesWithColors = Object.entries(classificationResult.diagnoses)
  .sort(([, confA], [, confB]) => confB - confA)
  .map(([diag, conf], index) => ({
    diag,
    conf,
    color: colorOptions[index % colorOptions.length],
  }));

  return (
    <Container sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, borderRadius:3,boxShadow:3, backgroundColor: isDarkMode ? "#1e1e1e" : "#fff"}}>
        <Typography variant="h4" gutterBottom color="text.primary" sx={{ fontWeight: 700 }}>
          ECG Classification Results
        </Typography>

        {/* Diagnoses */}
        <Box sx={{ 
          mt: 4, 
          p: 3, 
          border: isDarkMode ? "1px solid #444" : "1px solid #e0e0e0", 
          borderRadius: 2, 
          backgroundColor: isDarkMode ? "#1a1a1a" : "#f9f9f9" 
        }}>
          <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
            Diagnoses (Ranked by Confidence):
          </Typography>
          <List>
          {sortedDiagnosesWithColors.map(({ diag, conf, color }, index) => (
            <div key={index}>
              <ListItem sx={{ display: "flex", alignItems: "center" }}>
              <Button 
                onClick={() => handleColorBoxClick(color)}
                className="color-box-force"
                style={{ 
                  backgroundColor: color,
                  '--box-color': color 
                }}
                sx={{
                  minWidth: 24,
                  width: 24,
                  height: 24,
                  padding: 0,
                  marginRight: 2,
                  '&:hover': {
                    opacity: 0.8
                  }
                }}
                />

                <ListItemText 
                  primary={`${index + 1}. ${diag}`} 
                  secondary={`Confidence: ${(conf * 100).toFixed(0)}%`}
                  primaryTypographyProps={{
                    sx: { fontWeight: 600, color: isDarkMode ? "#fff" : "#333" }
                  }}
                  secondaryTypographyProps={{
                    sx: { color: isDarkMode ? "#bbb" : "#666" }
                  }}
                />
              </ListItem>
              {index < sortedDiagnosesWithColors.length - 1 && <Divider />}
            </div>
          ))}
          </List>
        </Box>

        {/* Highlighted ECG Image */}
        {highlightedImageUrl && (
            <Box sx={{ mt: 4, border: isDarkMode ? "1px solid #444" : "1px solid #e0e0e0",  borderRadius: 2, p: 2, backgroundColor: isDarkMode ? "#1a1a1a" : "#f9f9f9"} }>
              <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
                ECG Sections Leading to Diagnosis
              </Typography>
              <Box
                component="img"
                src={highlightedImageUrl}
                alt="Highlighted ECG Sections"
                sx={{ width: "100%", height: "auto", display: "block",  borderRadius: 1, border: isDarkMode ? "1px solid #555" : "1px solid #ddd" }}
              />
            </Box>
          )}
        {/* Feedback */}
        <Box sx={{ mt: 4, p: 3, border: isDarkMode ? "1px solid #444" : "1px solid #e0e0e0", borderRadius: 2, backgroundColor: isDarkMode ? "#1a1a1a" : "#f9f9f9" }}>
          <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
            Do you agree with the results?
          </Typography>
          {submittedFeedback ? (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              Your feedback: {feedback}
            </Typography>
          ) : (
            <>
              <RadioGroup
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  if (e.target.value !== "Other") {
                    setOtherFeedback("");
                  }
                }}
                sx={{ mt: 2, gap: 1 }}
              >
                <FormControlLabel value="Yes" control={<Radio sx={{ color: isDarkMode ? "#fff" : "#000" }} />} label="Yes" />
                <FormControlLabel value="No" control={<Radio  sx={{ color: isDarkMode ? "#fff" : "#000" }} />} label="No" />
                <FormControlLabel value="Other" control={<Radio sx={{ color: isDarkMode ? "#fff" : "#000" }} />} label="Other" />
              </RadioGroup>

              {feedback === "Other" && (
                <TextField
                  fullWidth
                  label="Please specify"
                  variant="outlined"
                  sx={{ mt: 2 }}
                  value={otherFeedback}
                  onChange={(e) => setOtherFeedback(e.target.value)}
                />
              )}

              {!submittedFeedback && (
                <Button variant="contained" color="primary" onClick={handleSubmitFeedback} sx={{ mt: 2, fontWeight:600, width: { xs: "100%", sm: "auto" } }}>
                  Submit Feedback
                </Button>
              )}
            </>
          )}
        </Box>
        {/* Popup after we select the color */}
        <Dialog 
          open={showColorPopup} 
          onClose={() => setShowColorPopup(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ 
            backgroundColor: isDarkMode ? "#1e1e1e" : "#fff",
            color: isDarkMode ? "#fff" : "#000"
          }}>
            ECG Section Highlight
          </DialogTitle>
          <DialogContent sx={{ 
            backgroundColor: isDarkMode ? "#1e1e1e" : "#fff",
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '300px'
          }}>
            {loadingColor ? (
              <CircularProgress />
            ) : selectedColorImage ? (
              <img 
                src={`data:image/png;base64,${selectedColorImage}`} 
                alt="Selected ECG Section" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '70vh',
                  borderRadius: '4px',
                  border: isDarkMode ? '1px solid #444' : '1px solid #ddd'
                }} 
              />
            ) : (
              <Typography color="text.secondary">
                No image available
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ 
            backgroundColor: isDarkMode ? "#1e1e1e" : "#fff",
            padding: '16px 24px'
          }}>
            <Button 
              onClick={() => setShowColorPopup(false)}
              sx={{ color: isDarkMode ? "#fff" : "#000" }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default ECGResults;