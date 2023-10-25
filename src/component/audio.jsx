import React, { useState, useEffect } from "react";
import hark from "hark";
import style from "./audio.module.css";

const ContinuousAudioRecorder = () => {
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechEvents, setSpeechEvents] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isloading, setIsLoading] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [error, setError] = useState("");

  const sendAudioToBackend = async (audioBlob) => {
    try {
      setError("");
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/xi/transcribe`,
        {
          method: "POST",
          body: formData,
        }
      );
      setIsLoading(false);
      setAudioChunks([]);
      if (!response.ok) {
        throw new Error(`Network response was not ok ${response.statusText}`);
      }
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      setIsPlaying(true);
      source.start();
      source.onended = () => {
        setIsPlaying(false);
      };

      // TODO: Handle the backend response as needed
    } catch (error) {
      setIsLoading(false);
      setError(error.message);
      console.error("Error sending audio data: ", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        console.log(event.data);
        setAudioChunks((prevChunks) => [...prevChunks, event.data]);
      };
      setMediaRecorder(recorder);

      recorder.start(); // Remove timeslice parameter

      const options = { threshold: -50 };
      const speechEvents = hark(stream, options);
      setSpeechEvents(speechEvents);
      speechEvents.on("speaking", () => {
        setError("");
        if (isPlaying || isloading) return;
        console.log("User is speaking");
        if (recorder.state === "inactive") {
          recorder.start(); // Start a new recording session when user starts speaking
        }
      });
      speechEvents.on("stopped_speaking", () => {
        if (isPlaying || isloading) return;
        console.log("User stopped speaking");
        if (recorder.state === "recording") {
          const id = setTimeout(() => {
            recorder.stop();
            clearTimeout(id);
          }, 3000);
          setTimeoutId(id);
        }
      });

      setIsRecording(true);
    } catch (error) {
      setError(error.message);
      console.error("Error starting recording: ", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    if (speechEvents) {
      speechEvents.stop();
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (audioChunks.length && !isloading) {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      sendAudioToBackend(audioBlob);
      setAudioChunks([]);
    }
  }, [audioChunks, isloading]);

  useEffect(() => {
    return () => stopRecording();
  }, []);

  return (
    <div className={`${style.audio}`}>
      <div className={`${style["buttons"]}`}>
        <button
          onClick={startRecording}
          disabled={isRecording}
          className={`${style.callButton}`}
        >
          Call Steve
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className={`${style.endButton}`}
        >
          End call
        </button>
      </div>
      {isloading || error ? (
        <p>{error || "Hold on, Steve is thinking of a response..."}</p>
      ) : null}
    </div>
  );
};

export default ContinuousAudioRecorder;
