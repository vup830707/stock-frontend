pipeline {
  agent any

  environment {
    IMAGE = "stock-frontend"
    CONTAINER = "stock-frontend"
    HOST_PORT = "3000"   // 你用瀏覽器開 localhost:3000
  }

  stages {
    stage('Install') {
      steps { sh 'npm ci' }
    }

    stage('Build') {
      steps { sh 'npm run build' }
    }

    stage('Docker Build') {
      steps {
        // Dockerfile 在 repo 根目錄就用 .
        sh 'docker build -t ${IMAGE}:latest .'
      }
    }

    stage('Deploy (Docker)') {
      steps {
        sh '''
          docker rm -f ${CONTAINER} || true
          docker run -d --name ${CONTAINER} -p ${HOST_PORT}:80 ${IMAGE}:latest
        '''
      }
    }
  }
}
