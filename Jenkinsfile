pipeline {
  agent {
    docker {
      image 'node:20-alpine'
      args '-u root:root'
    }
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
