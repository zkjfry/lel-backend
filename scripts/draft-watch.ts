import { io } from 'socket.io-client';

const tournamentId =
  Number(
    process.argv[2] ?? '2',
  );

const socket = io(
  'http://localhost:3000',
  {
    transports: [
      'websocket',
    ],
  },
);

socket.on(
  'connect',
  () => {
    console.log(
      'Socket connected:',
      socket.id,
    );

    socket.emit(
      'draft:join',
      {
        tournamentId,
      },
    );
  },
);

socket.on(
  'draft:state',
  (state) => {
    console.log('');
    console.log(
      '==============================',
    );

    console.log(
      'DRAFT STATE UPDATED',
    );

    console.log(
      '==============================',
    );

    console.log(
      'Status:',
      state.session?.status,
    );

    console.log(
      'Pick:',
      state.session?.currentPick,
    );

    console.log(
      'Round:',
      state.session?.currentRound,
    );

    console.log(
      'Current Team:',
      state.session?.currentTeamId,
    );

    console.log(
      'Available:',
      state.availablePlayers?.length,
    );

    console.log(
      'Completed:',
      state.progress?.completedPicks,
    );

    console.log(
      'Remaining:',
      state.progress?.remainingPicks,
    );
  },
);

socket.on(
  'draft:picked',
  (data) => {
    console.log(
      'Player picked:',
      data,
    );
  },
);

socket.on(
  'exception',
  (error) => {
    console.error(
      'Socket exception:',
      error,
    );
  },
);

socket.on(
  'connect_error',
  (error) => {
    console.error(
      'Connect error:',
      error.message,
    );
  },
);