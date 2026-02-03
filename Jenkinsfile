pipeline {
  agent any

  stages {
    stage('Install Dependencies') {
      steps {
        echo 'Installing npm dependencies...'
        sh 'npm ci'
      }
    }

    stage('Build Frontend') {
      steps {
        echo 'Building frontend...'
        sh 'npm run build'
      }
    }
  }
}
