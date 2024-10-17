import React, { useEffect, useState } from 'react';
import { db } from '../firebase'; // Adjust path to your Firebase config
import { doc, collection, getDocs } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2'; // Chart.js Bar component
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register the components needed for the Bar chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ResultsModal = ({ transactionId, onClose }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch positions from Firestore
    const fetchPositions = async () => {
      const positionsRef = collection(doc(db, 'transactions', transactionId), 'positions');
      const positionsSnapshot = await getDocs(positionsRef);

      const positionsData = positionsSnapshot.docs.map(doc => doc.data());
      setPositions(positionsData);
      setLoading(false);
    };

    fetchPositions();
  }, [transactionId]);

  if (loading) return <div>Loading...</div>;

  // Prepare data for the chart
  const clientPosition = positions.find(pos => pos.entity === 'Client') || { CR: 0, DR: 0 };
  const companyPosition = positions.find(pos => pos.entity === 'Internal') || { CR: 0, DR: 0 };
  const agentPositions = positions.filter(pos => pos.entity=== 'Suppiler');

  const agentTotalPosition = agentPositions.reduce(
    (total, agent) => total + (agent.CR - agent.DR),
    0
  );

  const data = {
    labels: ['Client', 'Company', 'Agents'],
    datasets: [
      {
        label: 'Net Position',
        data: [
          clientPosition.CR - clientPosition.DR, // Client net position
          companyPosition.CR - companyPosition.DR, // Company net position
          agentTotalPosition, // Combined agents net position
        ],
        backgroundColor: ['rgba(255, 99, 132, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(75, 192, 192, 0.2)'],
        borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-3/4 max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-6">Transaction Results</h2>
        <Bar data={data} height={100} /> {/* Adjusted height for larger graph */}

        <div className="mt-6 flex justify-end">
          <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsModal;
