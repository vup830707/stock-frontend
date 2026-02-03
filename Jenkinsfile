pipeline {
  agent any

  tools {
    nodejs 'node20'
  }

  stages {
    stage('Install') {
      steps {
        sh 'node -v'
        sh 'npm -v'
        sh 'npm ci'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
  }
}
