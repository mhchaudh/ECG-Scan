import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./Confirm.css";
import { Grid, Typography, Button, ToggleButton, ToggleButtonGroup, TextField, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemText, Paper, Box, CircularProgress} from "@mui/material";
import { Male, Female } from "@mui/icons-material";
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import WarningIcon from '@mui/icons-material/Warning';
import "leaflet/dist/leaflet.css";
import Fuse from 'fuse.js';
import debounce from 'lodash.debounce';

// use IndexedDB instead of localstorage
const initializeDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ECGAppDB'); 

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'uniqueId' });
        historyStore.createIndex('byDate', 'dateTime', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('identifiers')) {
        db.createObjectStore('identifiers', { keyPath: 'identifier' });
      }
      
      if (!db.objectStoreNames.contains('images')) {
        const imagesStore = db.createObjectStore('images', { keyPath: 'uniqueId' });
        imagesStore.createIndex('byType', 'type', { unique: false }); // Add index for image type
      }
      
      if (!db.objectStoreNames.contains('classificationResults')) {
        db.createObjectStore('classificationResults', { keyPath: 'uniqueId' });
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

const Confirm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { imageUrl } = location.state || {};

  const [crop, setCrop] = useState({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  const [croppedImage, setCroppedImage] = useState(null);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [patientstatus, setPatientstatus] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locationDetails, setLocationDetails] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [db, setDb] = useState(null);
  const [previousIdentifiers, setPreviousIdentifiers] = useState([]);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const originalImageRef = useRef(null);

  const fuse = new Fuse([], { keys: ["display_name"], threshold: 0.3 });
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    // Initialize IndexedDB
    initializeDB().then(database => {
      setDb(database);
      loadPreviousIdentifiers(database);
    }).catch(error => {
      console.error("Error initializing DB:", error);
    });

    if (!imageUrl) navigate("/home");
    else loadImage(imageUrl);
  }, [imageUrl, navigate]);

  const loadPreviousIdentifiers = (database) => {
    const transaction = database.transaction(['identifiers'], 'readonly');
    const store = transaction.objectStore('identifiers');
    const request = store.getAll();

    request.onsuccess = () => {
      setPreviousIdentifiers(request.result.map(item => item.identifier));
    };

    request.onerror = (event) => {
      console.error("Error loading identifiers:", event.target.error);
    };
  };

  const loadImage = (url) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      originalImageRef.current = img;
    };
  };

  const fetchLocationSuggestions = async (query) => {
    if (!query.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`);
      if (!response.ok) throw new Error("Failed to fetch location suggestions.");
      const data = await response.json();
  
      const uniqueLocations = data.reduce((acc, current) => {
        const isDuplicate = acc.some(location => location.display_name === current.display_name);
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);
  
      setLocationSuggestions(uniqueLocations);
      setIsDropdownOpen(true);
    } catch (error) {
      console.error("Error fetching location suggestions:", error);
      setLocationSuggestions([]);
      setIsDropdownOpen(false);
    }
  };

  const debouncedFetchLocationSuggestions = useRef(debounce(fetchLocationSuggestions, 500)).current;

  useEffect(() => {
    if (locationInput.trim() && !isLocationSelected) {
      debouncedFetchLocationSuggestions(locationInput);
    } else if (!locationInput.trim()) {
      setLocationSuggestions([]);
      setIsDropdownOpen(false);
      setIsLocationSelected(false);
    }
    return () => debouncedFetchLocationSuggestions.cancel();
  }, [locationInput, debouncedFetchLocationSuggestions, isLocationSelected]);

  const handleLocationSelect = (selectedLocation) => {
    setLocationInput(selectedLocation.display_name);
    setLocationDetails({
      lat: selectedLocation.lat,
      lon: selectedLocation.lon,
      display_name: selectedLocation.display_name,
    });
    setIsDropdownOpen(false);
    setLocationSuggestions([]);
    setIsLocationSelected(true);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setLocationInput(value); 
    if (value.trim()) {
      const results = fuse.search(event.target.value);
      setLocationSuggestions(results.map((result) => result.item));
      setIsDropdownOpen(true);
    } else {
      setLocationSuggestions([]);
      setIsDropdownOpen(false);
    }
  };

  const handleClickOutside = (event) => {
    if (event.target.closest(".location-dropdown") === null) setIsDropdownOpen(false);
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRetake = () => navigate("/home", { state: { cameFromConfirm: true } });

  const handleConfirm = async () => {
    try {
      if (!identifier || !age || !gender || !patientstatus || !locationDetails) {
        alert("Please fill in all the required fields");
        return;
      }
  
      setLoading(true);
      const uniqueId = generateUniqueId();
      await saveHistory(uniqueId);
      const imageToSave = croppedImage || imageUrl;
      const filename = await saveImageAndDetails(imageToSave, uniqueId);
      await sendLocationToMap(uniqueId, filename);
      await classifyECGAndNavigate(uniqueId, filename);
    } catch (error) {
      console.error("Error in handleConfirm: ", error);
      setLoading(false);
    }
  };

  const generateUniqueId = () => {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const saveHistory = async (uniqueId) => {
    if (!db) throw new Error("Database not initialized");
    
    const now = new Date();
    const date = now.toLocaleDateString('en-CA'); 
    const dateTime = now.toLocaleTimeString('en-CA', { hour12: false });
    
    const historyItem = {
      uniqueId,
      identifier,
      status: patientstatus,
      age,
      gender,
      location: locationDetails,
      filename: null,
      originalImageId: uniqueId,
      boundedBoxImageId: `${uniqueId}_bbox`, // boundedboximage
      date,
      dateTime,
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      
      const request = store.add(historyItem);
      
      request.onsuccess = () => {
        // save identifier if it is new
        saveIdentifier(identifier).then(resolve).catch(reject);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  

  const saveIdentifier = async (identifier) => {
    if (!db) throw new Error("Database not initialized");
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['identifiers'], 'readwrite');
      const store = transaction.objectStore('identifiers');
      
      const request = store.put({ identifier });
      
      request.onsuccess = resolve;
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  const saveImageAndDetails = async (imageToSave, uniqueId) => {
    const image = new Image();
    image.src = imageToSave;
  
    return new Promise((resolve, reject) => {
      image.onload = async () => {
        try {
          const imageBase64 = await convertImageToBase64(image);
          
          // save the original image to indexeddb
          await saveImageToDB(uniqueId, imageBase64);
          
          // upload the image to the server
          const uploadResponse = await fetch(`${API_URL}/api/image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: imageToSave,
              age,
              gender,
              identifier,
              location: locationDetails,
            }),
          });
  
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            const filename = uploadData.filename;
            const boundedBoxImage = uploadData.boundedboximage;
  
            // saved the boundedboximage to IndexedDB
            if (boundedBoxImage) {
              await saveBoundedBoxImageToDB(uniqueId, boundedBoxImage);
            }
  
            // update history with filename(used to identify ecgs individually)
            await updateHistoryWithFilename(uniqueId, filename);
            
            resolve(filename);
          } else {
            console.error("Upload failed");
            reject("Upload failed");
          }
        } catch (error) {
          console.error("Error in saveImageAndDetails: ", error);
          reject(error);
        }
      };
    });
  };
  
  const saveBoundedBoxImageToDB = async (uniqueId, imageData) => {
    if (!db) throw new Error("Database not initialized");
    
    // normalize the image data
    let processedImageData;
    try {
      if (!imageData) throw new Error("No image data provided");
      
      processedImageData = imageData.startsWith('data:image') 
        ? imageData 
        : `data:image/png;base64,${imageData}`;
        
      // validation(checking image format)
      if (!processedImageData.match(/^data:image\/(png|jpeg|jpg);base64,/)) {
        throw new Error("Invalid image format");
      }
    } catch (error) {
      console.error("Image processing error:", error);
      throw error;
    }
    // adding boundedboximage to indexeddb
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.put({ 
        uniqueId: `${uniqueId}_bbox`,
        imageData: processedImageData,
        type: 'bounded_box',
        createdAt: new Date().toISOString()
      });
      
      request.onsuccess = () => {
        console.log(`Bounded box image saved: ${uniqueId}_bbox`);
        resolve();
      };
      request.onerror = (event) => {
        console.error("IndexedDB save error:", event.target.error);
        reject(event.target.error);
      };
    });
  };
  // saving the original image to indexeddb
  const saveImageToDB = async (uniqueId, imageData) => {
    if (!db) throw new Error("Database not initialized");
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.put({ uniqueId, imageData });
      
      request.onsuccess = resolve;
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  // adding the unique ecg uuid to the db
  const updateHistoryWithFilename = async (uniqueId, filename) => {
    if (!db) throw new Error("Database not initialized");
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      
      const getRequest = store.get(uniqueId);
      
      getRequest.onsuccess = () => {
        const historyItem = getRequest.result;
        if (historyItem) {
          historyItem.filename = filename;
          const putRequest = store.put(historyItem);
          
          putRequest.onsuccess = resolve;
          putRequest.onerror = (event) => {
            reject(event.target.error);
          };
        } else {
          reject(new Error("History item not found"));
        }
      };
      
      getRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  // sending the location to the server to display in the map
  const sendLocationToMap = async (uniqueId, filename) => {
    try {
      const mapResponse = await fetch(`${API_URL}/api/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          filename,
          location: locationDetails,
        }),
      });

      if (!mapResponse.ok) {
        console.error("Failed to save location details");
        throw new Error("Failed to save location details");
      }
    } catch (error) {
      console.error("Error in sendLocationToMap: ", error);
      throw error;
    }
  };

  // get classification results and send to ecg-results
  const classifyECGAndNavigate = async (uniqueId, filename) => {
    try {
      await classifyECG(uniqueId, filename);
      navigate(`/ecg-results?uniqueId=${uniqueId}&filename=${filename}&identifier=${identifier}&age=${age}&gender=${gender}`);
    } catch (error) {
      console.error("Error in classifying the ECG: ", error);
      throw error;
    } finally {
      setLoading(false); 
    }
  };
  // get classification from server 
  const classifyECG = async (uniqueId, filename) => {
    const classifyResponse = await fetch(`${API_URL}/api/ecg/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ecg: "dummy_ecg_signal",
        sex: gender || "male",
        age: age || 30,
      }),
    });

    if (!classifyResponse.ok) {
      console.error("Classification failed");
      return;
    }

    const classifyData = await classifyResponse.json();
    await saveClassificationResult(uniqueId, classifyData);

    const highestDiagnosis = getHighestConfidenceDiagnosis(classifyData.diagnoses);
    if (highestDiagnosis) await sendDiagnosis(highestDiagnosis, filename);
  };
  // saving the classificatio result to indexeddb
  const saveClassificationResult = async (uniqueId, result) => {
    if (!db) throw new Error("Database not initialized");
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['classificationResults'], 'readwrite');
      const store = transaction.objectStore('classificationResults');
      
      const request = store.put({ uniqueId, result });
      
      request.onsuccess = resolve;
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };
  // getting the highest confident diagnosis which we will show for the map
  const getHighestConfidenceDiagnosis = (diagnoses) => {
    let highestDiagnosis = null;
    let highestConfidence = 0;

    for (const [diagnosis, confidence] of Object.entries(diagnoses)) {
      if (confidence > highestConfidence) {
        highestDiagnosis = diagnosis;
        highestConfidence = confidence;
      }
    }

    return highestDiagnosis;
  };
  // we add the diagnosis details to the server
  const sendDiagnosis = async (diagnosis, filename) => {
    const diagnosesResponse = await fetch(`${API_URL}/api/diagnoses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: locationDetails,
        diagnoses: diagnosis,
        identifier: identifier,
        age: age,
        gender: gender,
        filename: filename
      }),
    });

    if (!diagnosesResponse.ok) console.error("Failed to send diagnosis");
  };
 // this is to convert the image to base64(for storage purposes)
  const convertImageToBase64 = (img) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
  
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
  
      canvas.width = img.width;
      canvas.height = img.height;
  
      ctx.drawImage(img, 0, 0, img.width, img.height);
      resolve(canvas.toDataURL("image/png"));
    });
  };
  // so we can download the cropped image(or original if not cropped)
  const handleDownload = () => {
    const imagetodownload = croppedImage || imageUrl;
    const link = document.createElement("a");
    link.href = imagetodownload;
    link.download = "cropped-image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onCropComplete = (crop) => {
    if (originalImageRef.current && canvasRef.current) {
      const image = originalImageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const scaleX = image.naturalWidth / imageRef.current.width;
      const scaleY = image.naturalHeight / imageRef.current.height;

      canvas.width = crop.width * scaleX;
      canvas.height = crop.height * scaleY;
      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      setCroppedImage(canvas.toDataURL("image/png"));
    }
  };

  const handleAgeChange = (e) => {
    const value = e.target.value;
    if (value < 0 || value > 999) setAge("");
    else setAge(value);
  };

  const handleGenderChange = (e) => setGender(e.target.value);
  const handleIdentifierChange = (e) => setIdentifier(e.target.value);

  const handleConfirmClick = () => {
    if (loading) return;
    setShowConfirmPopup(true);
  };

  const handlePopupResponse = (confirm) => {
    setShowConfirmPopup(false);
    if (confirm) handleConfirm();
  };
  
  return (
    <>
      {loading && (
        <Box sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.7)",
          zIndex: 9999,
          color: "white"
        }}>
          <CircularProgress size={80} thickness={4} sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>Analyzing ECG...</Typography>
          <Typography variant="body1">This may take a few moments</Typography>
        </Box>
      )}
  
      <Grid container spacing={3} justifyContent="center" alignItems="center" direction="column">
        <Grid item>
          <Typography variant="h4" color="black">
            Adjust Your Image
          </Typography>
        </Grid>

        <Grid item container spacing={2} justifyContent="center" sx={{ maxWidth: "800px", margin: "0 auto",padding: 3}}>
           {/* Identifier */}
          <Grid item>
            <TextField
              fullWidth
              autoComplete="off"
              label="Unique Patient Identifier"
              variant="outlined"
              value={identifier}
              onChange={handleIdentifierChange}
              sx={{ width: 300, backgroundColor: "background.paper",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px"
                }}}
              inputProps={{ list: "identifiers" }}
            />
            <datalist id="identifiers">
              {previousIdentifiers.map((id, index) => (
                <option key={index} value={id}>
                  {id}
                </option>
              ))}
            </datalist>
          </Grid>
          {/*Patient Status*/}
          <Grid item  xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel shrink={Boolean(patientstatus)}>Patient Status</InputLabel>
              <Select
                value={patientstatus}
                onChange={(e) => setPatientstatus(e.target.value)}
                displayEmpty
                notched
                sx={{
                  borderRadius: "12px",
                  textAlign: "left"
                }}
              >
                <MenuItem value="Pre-treatment">Pre-treatment</MenuItem>
                <MenuItem value="During treatment">During treatment</MenuItem>
                <MenuItem value="Post-treatment">Post-treatment</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {/*Location*/}
          <Grid item>
              <div className="location-dropdown" style={{ position: "relative" }}>
                <TextField
                  label="Location"
                  variant="outlined"
                  value={locationInput}
                  onChange={handleInputChange}
                  sx={{ width: 300 }}
                  onFocus={() => {if (locationSuggestions.length > 0 && !locationInput) {
                    setIsDropdownOpen(true);
                  }
                }}


                />
                {isDropdownOpen && locationSuggestions.length > 0 && (
                  <Paper
                    style={{
                      position: "absolute",
                      width: "100%",
                      maxHeight: "200px",
                      overflowY: "auto",
                      zIndex: 1,
                      marginTop: "4px",
                    }}
                  >
                    <List>
                      {locationSuggestions.map((location, index) => (
                        <ListItem
                          key={index}
                          button = {"true"}
                          onClick={() => handleLocationSelect(location)}
                        >
                          <ListItemText primary={location.display_name} />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </div>
            </Grid>
        </Grid>
  
        <Grid item container spacing={2} justifyContent="center">
          {/*Age */}
          <Grid item>
            <TextField
              label="Age"
              variant="outlined"
              type="number"
              value={age}
              onChange={handleAgeChange}
              inputProps={{ min: 0, max: 999 }}
            />
          </Grid> 
          {/*Gender */}
          <Grid item>
            <ToggleButtonGroup
              fullWidth
              value={gender}
              exclusive
              onChange={handleGenderChange}
              sx={{ display: "flex", justifyContent: "center", "& .MuiToggleButton-root": {textTransform: "none", fontWeight: 600,"&.Mui-selected": {color: "white !important"}}}} >
              <ToggleButton
                value="male"
                selected={gender === "male"}
                sx={{
                  backgroundColor: gender === "male" ? "#1976d2 !important" : "lightgray",
                  color: "white !important",
                  "&:hover": { backgroundColor: gender === "male" ? "#1565c0 !important" : "gray" },"&.Mui-selected": {bgcolor: "primary.main"}
                }}
              >
                <Male sx={{ marginRight: 1, color: "white" }} /> Male
              </ToggleButton>
  
              <ToggleButton
                value="female"
                selected={gender === "female"}
                sx={{
                  backgroundColor: gender === "female" ? "#e91e63 !important" : "lightgray",
                  color: "white !important",
                  "&:hover": { backgroundColor: gender === "female" ? "#c2185b !important" : "gray"}, "&.Mui-selected": { bgcolor: "secondary.main"}}}
              >
                <Female sx={{ marginRight: 1, color: "white" }} /> Female
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
  
        {/* Image Cropping Section */}
        <Grid item>
          <div className="image-container">
            <ReactCrop
              src={imageUrl}
              crop={crop}
              onChange={setCrop}
              onComplete={onCropComplete}
              ruleOfThirds
            >
              <img src={imageUrl} alt="Captured" ref={imageRef} className="confirm-image" />
            </ReactCrop>
            <div className="cropped-preview">
              <Typography variant="h6" gutterBottom>
                Cropped Image:
              </Typography>
              {croppedImage ? (
                <img src={croppedImage} alt="Cropped Preview" className="cropped-image" />
              ) : (
                <Typography variant="body1">No cropped image yet</Typography>
              )}
            </div>
          </div>
        </Grid>
  
        <canvas ref={canvasRef} style={{ display: "none" }} />
  
        {/* Buttons */}
        <Grid item sx={{ width: '100%', mt: 4 }}>
          <Grid container spacing={2} justifyContent="center">
            <Grid item>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleRetake}
                sx={{
                  minWidth: 120,
                  px: 3,
                  py: 1.5,
                  borderRadius: '8px',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: 'error.light',
                    color: 'white'
                  }
                }}
                startIcon={<ReplayIcon />}
              >
                Retake
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={handleConfirmClick}
                sx={{
                  minWidth: 120,
                  px: 3,
                  py: 1.5,
                  borderRadius: '8px',
                  fontWeight: 600,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                    backgroundColor: 'primary.dark'
                  }
                }}
                startIcon={<CheckCircleIcon />}
              >
                Confirm
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="success"
                onClick={handleDownload}
                sx={{
                  minWidth: 120,
                  px: 3,
                  py: 1.5,
                  borderRadius: '8px',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: 'success.dark'
                  }
                }}
                startIcon={<DownloadIcon />}
              >
                Download
              </Button>
            </Grid>
          </Grid>
        </Grid>

        {/* Confirmation Popup */}
        <Dialog 
          open={showConfirmPopup} 
          onClose={() => setShowConfirmPopup(false)}
          PaperProps={{
            sx: {
              borderRadius: '12px',
              minWidth: '400px',
              maxWidth: '90vw'
            }
          }}
        >
          <DialogTitle sx={{
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 2.5,
            px: 3
          }}>
            <WarningIcon sx={{ fontSize: 28 }} />
            <Typography variant="h6" component="span">
              Confirm ECG submission
            </Typography>
          </DialogTitle>
          
          <DialogContent sx={{ 
            py: 4,  
            px: 3,
            '&.MuiDialogContent-root': {
              paddingTop: '32px'  
            }
          }}>
            <Typography variant="body1" sx={{ 
              mb: 2,
              textAlign: 'center'  
            }}>
              Are you sure you want to submit this ECG report?
            </Typography>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button 
              onClick={() => handlePopupResponse(false)}
              variant="outlined"
              color="inherit"
              sx={{
                borderRadius: '6px',
                px: 3,
                borderWidth: '2px',
                '&:hover': {
                  borderWidth: '2px'
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handlePopupResponse(true)}
              variant="contained"
              color="primary"
              sx={{
                borderRadius: '6px',
                px: 3,
                fontWeight: 600
              }}
              autoFocus
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Grid>
    </>
  );  
}

export default Confirm;