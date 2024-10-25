import React, { useState, useCallback } from 'react';

export default function ImageUploadModal({ isOpen, onClose, onSubmit }) {
  const [image, setImage] = useState(null);
  const [notes, setNotes] = useState('');

  // Handle file drop for image upload
  const onDrop = useCallback((event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = () => {
    onSubmit(image, notes);
    setImage(null);
    setNotes('');
    onClose();
  };

  return (
    isOpen && (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-gray-800 p-6 rounded shadow-lg text-white w-full max-w-md">
          <h3 className="text-lg font-bold mb-4">Upload Image</h3>
          
          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              onChange={onDrop}
              className="w-full p-2 border border-gray-500 rounded bg-gray-700 text-white cursor-pointer"
            />
            {image && (
              <div className="relative mt-4">
                <img src={image} alt="Uploaded preview" className="max-h-40 mx-auto" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <textarea
            placeholder="Add notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2 border border-gray-500 rounded bg-gray-700 text-white mb-4"
          />

          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="bg-gray-500 text-white p-2 rounded"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              className="bg-blue-600 text-white p-2 rounded"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    )
  );
}
