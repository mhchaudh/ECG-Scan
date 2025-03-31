import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// Refrenced: https://mui.com/material-ui/all-components/?srsltid=AfmBOoo3ZuM3R9qLhp_JDLn0Gp7fmQW_nsLmIcqM5lASyIL9qzzICiwf
import { Button, Grid, Typography, IconButton, Dialog, DialogTitle, DialogActions, Checkbox, DialogContent, FormControlLabel} from "@mui/material";
import { PhotoCamera, CloudUpload, FlashOn, FlashOff, FlipCameraAndroid } from "@mui/icons-material";
import { useDropzone } from "react-dropzone"; 
import logo from '../assets/1-3b2842e1-removebg-preview.png'; 
import './Home.css'; 

const Home = () => {
  const fileInputRef = useRef(null); 
  const videoRef = useRef(null); 
  const navigate = useNavigate(); 
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [disclaimerOpen, setDisclaimerOpen] = useState(!sessionStorage.getItem("disclaimerAccepted"));
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false); 
  const [flashEnabled, setFlashEnabled] = useState(false); 
  const [facingMode, setFacingMode] = useState("environment"); 
  const location = useLocation(); 

  const handleTakePictureClick = useCallback(() => {
    setIsCameraOpen(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      })
      .catch(err => {
        console.error("Error accessing camera: ", err);
      });
  }, [facingMode]);

  // check if the user is coming from confirmation pages
  const cameFromConfirm = location.state?.cameFromConfirm || false;
  const cameFromConfirmUpload = location.state?.cameFromConfirmUpload || false;
  // if it is from picture, we retake the picture, if not, we retake the upload
  useEffect(() => {
    if (cameFromConfirm) {
      handleTakePictureClick();
    } else if (cameFromConfirmUpload) {
      handleUploadButtonClick();
    }
  }, [cameFromConfirm, cameFromConfirmUpload, handleTakePictureClick]);

  // this is to trigger the file input click for uploading an image
  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };

  // this is to handle file selection and navigate to the confirmation page
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  // this is to handle file drop or selection
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      processFile(file);
    }
  };

  // process the file and navigate to the confirmation page
  const processFile = (file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result;
      navigate('/confirmupload', { state: { imageUrl } });
    };
    reader.readAsDataURL(file);
  };

  // this is to capture the image from the video stream
  const handleCapture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageUrl = canvas.toDataURL('image/png');
    setIsCameraOpen(false);

    // stop the camera stream
    if (videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }

    // navigate to the confirmation page with the captured image
    setTimeout(() => {
      navigate('/confirm', { state: { imageUrl } });
    }, 500);
  };

  // toggle the camera flash (wont work on laptops, etc)
  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  // toggle between front and back camera(wont work on laptops, etc)
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setTimeout(handleTakePictureClick, 500); // restart the camera
  };
  const handleAcceptDisclaimer = () => {
    sessionStorage.setItem("disclaimerAccepted", "true");
    setDisclaimerOpen(false);
  };

  // react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: "image/*",
  });

  return (
    <>
      <Dialog open={disclaimerOpen} disableEscapeKeyDown>
        <DialogTitle>Disclaimer</DialogTitle>
        <DialogContent>
          <Typography>
            ECGenius is designed for informational purposes only and does not provide a medical diagnosis. Always consult a qualified healthcare professional for an official interpretation of your ECG results. By continuing, you acknowledge that the app is for supplementary analysis only.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={disclaimerAccepted} onChange={(e) => setDisclaimerAccepted(e.target.checked)} />}
            label="I accept the disclaimer"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAcceptDisclaimer} disabled={!disclaimerAccepted} color="primary" variant="contained">
            Proceed
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3} justifyContent="center" alignItems="center" direction="column" style={{ height: '100vh', padding: '0 24px', maxWidth: '600px',  margin: '0 auto' }}>
        {!isCameraOpen ? (
          <>
            <Grid item>
              <img 
                src={logo}
                alt="ECGenius Logo" 
                style={{ height: '200px', marginBottom: '16px',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }} 
              />
            </Grid>
            <Grid item>
              <Typography variant="h4" color="black" align="center" style={{ fontWeight: 'bold', marginBottom: '20px', fontFamily: 'Monaco' }}>
                Take or Upload ECG Report
              </Typography>
            </Grid>
            <Grid item>
              <Button 
                sx={{ backgroundColor: "#4CAF50", color: "white", "&:hover": { backgroundColor: "#388E3C" }, padding: "20px 46px",  
                fontSize: "1.5rem", height: "80px", minWidth: "250px", fontFamily: 'Monaco' }}
                variant="contained" color="primary" startIcon={<PhotoCamera />} onClick={handleTakePictureClick}>
                Open Camera
              </Button>
            </Grid>
            <Grid item>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileInputChange}
              />
              <div {...getRootProps()} style={{ textAlign: 'center', border: isDragActive ? '2px dashed #2196F3' : '2px dashed #ccc', padding: '20px', borderRadius: '4px', cursor: 'pointer' }}>
                <input {...getInputProps()} />
                {isDragActive ? (
                  <Typography variant="h6" color="primary">Drop the image here...</Typography>
                ) : (
                  <Button 
                    sx={{ backgroundColor: "#2196F3", color: "white", "&:hover": { backgroundColor: "#1976D2" }, padding: "20px 40px",  
                    fontSize: "1.5rem", height: "80px", minWidth: "250px", fontFamily: 'Monaco' }}
                    variant="contained" color="secondary" startIcon={<CloudUpload />}>
                    Upload Image
                  </Button>
                )}
              </div>
            </Grid>
          </>
        ) : (
          <Grid item>
            <div className="camera-container">
              <video ref={videoRef} className="camera-view"></video>
              <div className="camera-buttons">
                <IconButton color="primary" onClick={toggleFlash}>{flashEnabled ? <FlashOn /> : <FlashOff />}</IconButton>
                <IconButton color="primary" onClick={toggleCamera}><FlipCameraAndroid /></IconButton>
                <IconButton color="primary" onClick={handleCapture}><PhotoCamera /></IconButton>
              </div>
            </div>
          </Grid>
        )}
      </Grid>
    </>
  );
}

export default Home;