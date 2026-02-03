pipeline {
  agent {
    docker {
      image 'node:20-alpine'
      args '-u root:root'
      reuseNode true
    }
  }

  stages {
    stage('Check Env') {
      steps {
        sh 'node -v'
        sh 'npm -v'
        sh 'pwd'
        sh 'ls -la'
      }
    }

    stage('Install') {
      steps {
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
