import { useState, useEffect, useCallback } from "react";
import { Grid, Card, CardContent, Typography, Button, CardMedia, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel, TextField, Box, Stack} from "@mui/material";
import { useNavigate } from "react-router-dom";

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
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [patientIds, setPatientIds] = useState([]);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [, setComparisonImages] = useState({});
  const [db, setDb] = useState(null);

  // initialize db
  useEffect(() => {
    initializeDB().then(database => {
      setDb(database);
      loadHistory(database);
    }).catch(error => {
      console.error("Error initializing DB:", error);
    });
  }, []);

  // get the history from IndexedDB
  const loadHistory = (database) => {
    const transaction = database.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();
  
    request.onsuccess = async () => {
      const historyItems = request.result;
      
      // get the data for each history item
      const enrichedHistory = await Promise.all(historyItems.map(async (item) => {
        const image = await getImageFromDB(database, item.uniqueId);
        const boundedBoxImage = await getImageFromDB(database, `${item.uniqueId}_bbox`);
        const classification = await getClassificationFromDB(database, item.uniqueId);
        
        return {
          ...item,
          imageUrl: image?.imageData || null,
          boundedBoxImageUrl: boundedBoxImage?.imageData || null,
          classificationResult: classification?.result || null
        };
      }));
  
      setHistory(enrichedHistory);
      setPatientIds([...new Set(enrichedHistory.map(item => item.identifier))]);
    };
  
    request.onerror = (event) => {
      console.error("Error loading history:", event.target.error);
    };
  };

  // get the image from the IndexedDB
  const getImageFromDB = (database, uniqueId) => {
    return new Promise((resolve) => {
      const transaction = database.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const request = store.get(uniqueId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  };

  // get classification from the IndexedDB
  const getClassificationFromDB = (database, uniqueId) => {
    return new Promise((resolve) => {
      const transaction = database.transaction(['classificationResults'], 'readonly');
      const store = transaction.objectStore('classificationResults');
      const request = store.get(uniqueId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  };

  // filter the history based on the selected filters
  useEffect(() => {
    setFilteredHistory(
      history.filter((item) =>
        (statusFilter === "" || item.status === statusFilter) &&
        (patientFilter === "" || item.identifier === patientFilter) &&
        (dateFilter === "" || item.date === dateFilter)
      )
    );
  }, [statusFilter, patientFilter, dateFilter, history]);

  // get the images for comparison
  const fetchImagesforComparison = useCallback(async () => {
    if (!db) return;
    
    const imagesData = {};
  
    await Promise.all(
      selectedForComparison.map(async (uniqueId) => {
        const item = history.find((h) => h.uniqueId === uniqueId);
        if (!item) return;
  
        // use the bounded box image url 
        if (item.boundedBoxImageUrl) {
          imagesData[uniqueId] = item.boundedBoxImageUrl.split(',')[1]; // get the base64 data
        }
      })
    );
  
    setComparisonImages(imagesData); 
  }, [selectedForComparison, history, db]);
  
  // clear all history from the indexeddb
  const clearHistory = async () => {
    if (!db) return;
    
    try {
      // clear all the objects
      await Promise.all([
        clearObjectStore(db, 'history'),
        clearObjectStore(db, 'images'),
        clearObjectStore(db, 'classificationResults'),
        clearObjectStore(db, 'identifiers'),
      ]);
      
      setHistory([]);
      setPatientIds([]);
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };

  // clear an object store
  const clearObjectStore = (database, storeName) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = resolve;
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };

  // delete a single item from IndexedDB
  const deleteItem = async (uniqueId) => {
    if (!db) return;
    
    try {
      // Delete from all relevant stores
      await Promise.all([
        deleteFromStore(db, 'history', uniqueId),
        deleteFromStore(db, 'images', uniqueId),
        deleteFromStore(db, 'classificationResults', uniqueId),
      ]);
      
      // update the state
      setHistory(prev => prev.filter(item => item.uniqueId !== uniqueId));
      setPatientIds(prev => [...new Set(prev.filter(id => id !== history.find(item => item.uniqueId === uniqueId)?.identifier))]);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  //  delete from a specific store
  const deleteFromStore = (database, storeName, key) => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = resolve;
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
  };

  const handleCloseDialog = () => {
    setSelectedItem(null);
  };

  const handleViewECGResults = (uniqueId, filename, identifier, age, gender) => {
    navigate(`/ecg-results?uniqueId=${uniqueId}&filename=${filename}&identifier=${identifier}&age=${age}&gender=${gender}`);
  };

  const handleComparisonCheckbox = (item) => {
    let updatedSelection;
  
    if (selectedForComparison.includes(item.uniqueId)) {
      updatedSelection = selectedForComparison.filter((id) => id !== item.uniqueId);
    } else {
      updatedSelection = [...selectedForComparison, item.uniqueId];
      if (updatedSelection.length > 2) {
        updatedSelection = updatedSelection.slice(1);
      }
    }
  
    setSelectedForComparison(updatedSelection);
  };

  useEffect(() => {
    if (selectedForComparison.length === 2) {
      fetchImagesforComparison();
      setShowComparisonDialog(true);
    } else {
      setShowComparisonDialog(false);
    }
  }, [fetchImagesforComparison, selectedForComparison]); 
  
  const handleCloseComparisonDialog = () => {
    setShowComparisonDialog(false);
    setSelectedForComparison([]);
  };

  const getSelectedItems = () => {
    return history.filter((item) => selectedForComparison.includes(item.uniqueId));
  };

  return (
    <Grid container spacing={4} className="main-content"  justifyContent="center" alignItems="center" direction="column" sx={{minHeight: '100vh', py: 4, px: { xs: 2, sm: 4 }, backgroundColor: 'background.default' }}>
      <Grid item>
        <Typography variant="h3" color="black" align="center" sx={{ fontWeight: "bold", mb: 4, mt: 4,  color: "text.primary"}}>
          History
        </Typography>
      </Grid>

      {/* Filters */}
      <Grid container spacing={2} justifyContent="center" alignItems="center" sx={{ mb: 6, px:2 }}>
        {/* Filter by Patient Status */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel shrink>Filter by Patient Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              displayEmpty
              notched
            >
              <MenuItem value=""></MenuItem>
              <MenuItem value="Pre-treatment">Pre-treatment</MenuItem>
              <MenuItem value="During treatment">During treatment</MenuItem>
              <MenuItem value="Post-treatment">Post-treatment</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Filter by Patient ID */}
        <Grid item xs={6} sm={4} md={3}>
          <FormControl fullWidth>
            <InputLabel shrink>Filter by Patient ID</InputLabel>
            <Select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              displayEmpty
              notched
            >
              <MenuItem value=""></MenuItem>
              {patientIds.map((id) => (
                <MenuItem key={id} value={id}>{id}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Filter by Date */}
        <Grid item xs={6} sm={4} md={3}>
          <TextField
            label="Filter by Date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>
      </Grid>

      <Grid container justifyContent="center" sx={{ mb: 6}}>
        <Button variant="contained" color="error" onClick={clearHistory} sx={{ px: 4, py:1.5 }}>
          Clear History
        </Button>
      </Grid>

      {/* History Cards */}
      <Grid container spacing={4} sx={{ px: 4,  alignContent: "flex-start" }}>
        {filteredHistory.map((item, index) => (
          <Grid item key={index} xs={12} sm={6} md={4} lg={3}>
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column", transition: "transform 0.2s",'&:hover': {transform: "scale(1.02)", boxShadow: 6 }}}>
              <CardMedia
                component="img"
                height="220"
                image={item.imageUrl || ""}
                alt={`Uploaded image ${index + 1}`}
                onClick={() => handleViewDetails(item)}
                sx={{ cursor: "pointer", borderTopLeftRadius: 8, borderTopRightRadius: 8, objectFit: "cover"}}
              />
              <CardContent sx={{ flexGrow: 1, p: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
               >
                <Typography variant="subtitle1" fontWeight="bold">
                  Patient ID: {item.identifier}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedForComparison.includes(item.uniqueId)}
                      onChange={() => handleComparisonCheckbox(item)}
                      color="primary"
                    />
                  }
                  label="Compare"
                  sx={{ m: 0 }}
                />
              </Box>
              <Stack spacing={1} sx={{ width: "100%" }}>
                <Button size="small" variant="contained" color="primary" onClick={() => handleViewDetails(item)} sx={{ fontWeight: "bold" }}>
                  View Details
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  onClick={() => handleViewECGResults(item.uniqueId, item.filename, item.identifier, item.age, item.gender)}
                  sx={{ fontWeight: "bold" }}
                >
                  View ECG Results
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => deleteItem(item.uniqueId)} sx={{fontWeight: "bold" }}>
                  Delete
                </Button>
              </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Image Details */}
      {selectedItem && (
      <Dialog open={!!selectedItem} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: "primary.main", color: "white",displau:"flex",justifyContent: "space-between", alignItems: "center" }}>
        <span>Patient Details</span>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", color: "text.secondary" }}>
                Patient Information
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  boxShadow: 1,
                }}
              >
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">ID</Typography>
                    <Typography variant="body1">{selectedItem.identifier}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <Typography variant="body1">{selectedItem.status}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Age</Typography>
                    <Typography variant="body1">{selectedItem.age}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Gender</Typography>
                    <Typography variant="body1">{selectedItem.gender}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Date</Typography>
                    <Typography variant="body1">{selectedItem.date}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">Time</Typography>
                    <Typography variant="body1">{selectedItem.dateTime}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", color: "text.secondary" }}>
                Image Preview
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  boxShadow: 1,
                  textAlign: "center",
                }}
              >
                <img
                  src={selectedItem.imageUrl || ""}
                  alt="Uploaded"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "400px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    boxShadow: 3,
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseDialog} color="secondary" variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )}

      {/* Compare two ecg images */}
      {showComparisonDialog && (
  <Dialog open={true} onClose={handleCloseComparisonDialog} maxWidth="lg" fullWidth>
    <DialogTitle>Compare The Leads of Two ECG Images</DialogTitle>
    <DialogContent sx={{ py: 4 }}>
      <Grid container spacing={4} alignItems="center">
        {getSelectedItems().map((item) => (
          <Grid item key={item.uniqueId} xs={12} md={6}>
            <Box sx={{ 
              border: 1, 
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
              textAlign: "center"
            }}>
              <Typography variant="subtitle1" gutterBottom>
                Patient: {item.identifier}
              </Typography>
              <img
                src={item.boundedBoxImageUrl || ""}
                style={{ 
                  maxWidth: "100%", 
                  maxHeight: "400px",
                  objectFit: "contain"
                }}
                alt={`Bounded box ECG for ${item.identifier}`}
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    </DialogContent>
    <DialogActions>
      <Button onClick={handleCloseComparisonDialog} color="secondary">
        Close
      </Button>
    </DialogActions>
  </Dialog>
)}
    </Grid>
  );
};

export default History;